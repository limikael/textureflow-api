import * as THREE from 'three';
import {useEffect, useRef, useLayoutEffect, useMemo, useContext, useState, createContext} from "react";
import {useConstructor} from "../utils/react-util.jsx";

let NodeParentContext=createContext();

export function Scene({children, camera, class: className, nodeRef,
		onIntersectionChange, onFrame, onDragOver, ...props}) {
	let domRef=useRef();
	let sceneState=useConstructor(()=>({
		scene: new THREE.Scene(),
		renderer: new THREE.WebGLRenderer(),
		raycaster: new THREE.Raycaster(),
		pointer: new THREE.Vector2(),
		intersection: []
	}));

	function updatePointerFromMouseEvent(ev) {
		let rect=domRef.current.getBoundingClientRect();
		let x=(ev.clientX-rect.left)/rect.width;
		let y=(ev.clientY-rect.top)/rect.height;
		x=x*2-1;
		y=-(y*2-1);

		sceneState.pointer.set(x,y);
	}

	function handleMouseMove(ev) {
		updatePointerFromMouseEvent(ev);
	}

	function handleDragOver(ev) {
		updatePointerFromMouseEvent(ev);
		if (onDragOver)
			onDragOver(ev);
	}

	function updateIntersection() {
		let intersection=sceneState.raycaster.intersectObject(sceneState.scene,true);

		//intersection=intersection.map(i=>i.object);
		if (!compareIntersectionArray(intersection,sceneState.intersection)) {
			//console.log("intersection change");
			sceneState.intersection=intersection;
			if (onIntersectionChange)
				onIntersectionChange(intersection);
		}
	}

	useLayoutEffect(()=>{
		domRef.current.appendChild(sceneState.renderer.domElement);

		if (!sceneState.nodeRefCalled && nodeRef) {
			nodeRef(sceneState.scene,sceneState.renderer);
		}

		function animate() {
			//console.log("anim...");

			if (onFrame)
				onFrame();

			sceneState.renderer.setClearColor(0x000000,0);

			if (!camera)
				camera=new THREE.PerspectiveCamera();

			let el=domRef.current;
			if (el.clientWidth<el.clientHeight)
				camera.zoom=el.clientWidth/el.clientHeight;

			camera.aspect=el.clientWidth/el.clientHeight;
			camera.updateProjectionMatrix();
			sceneState.renderer.setSize(el.clientWidth,el.clientHeight);

			sceneState.raycaster.setFromCamera(sceneState.pointer,camera);
			updateIntersection();

			sceneState.renderer.render(sceneState.scene,camera);
		}

		sceneState.renderer.setAnimationLoop(animate);

		return (()=>{
			domRef.current.removeChild(sceneState.renderer.domElement);
			sceneState.renderer.setAnimationLoop(null);
		});
	},[]);

/*				onClick={onClick} onMouseDown={onMouseDown} onContextMenu={onContextMenu}
				onMouseUp={onMouseUp} onDrop={onDrop} tabIndex={0} onDragEnter={ev=>console.log("drag enter")}>*/

	return (
		<div ref={domRef} class={className} 
				onMouseMove={handleMouseMove}
				onDragOver={handleDragOver}
				{...props}>
			<NodeParentContext.Provider value={sceneState.scene}>
				{children}
			</NodeParentContext.Provider>
		</div>
	);
}

export function Node({type, value, ctor, children, nodeRef, ...props}) {
	let valueRef=useRef();
	if (!valueRef.current && ctor)
		valueRef.current=ctor();

	if (!valueRef.current && type)
		valueRef.current=new type();

	if (value)
		valueRef.current=value;

	for (let k in props) {
		switch (k) {
			/*case "color":
				valueRef.current.color.set(v);
				break;*/

			case "position":
				valueRef.current.position.copy(props[k]);
				break;

			default:
				valueRef.current[k]=props[k];
				break;
		}
	}

	let parent=useContext(NodeParentContext);
	useLayoutEffect(()=>{
		let currentValue=valueRef.current;
		if (currentValue)
			parent.add(currentValue);

		if (nodeRef)
			nodeRef.current=currentValue;

		return (()=>{
			if (currentValue)
				parent.remove(currentValue);
		});
	},[valueRef.current]);

	return (
		<NodeParentContext.Provider value={valueRef.current}>
			{children}
		</NodeParentContext.Provider>
	);
}
