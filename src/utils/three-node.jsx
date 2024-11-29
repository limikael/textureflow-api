import * as THREE from 'three';
import {useEffect, useRef, useLayoutEffect, useMemo, useContext, useState, createContext, useCallback} from "react";
import {useConstructor, useResizeObserver} from "../utils/react-util.jsx";
import {compareIntersectionArray} from "./three-util.js";

let NodeParentContext=createContext();

export function Scene({children, camera, class: className, nodeRef,
		onIntersectionChange, onFrame, onDragOver, 
		animationLoop, ...props}) {
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

	function handleMouseMove(ev) {
		updatePointerFromMouseEvent(ev);
		sceneState.raycaster.setFromCamera(sceneState.pointer,sceneState.camera);
		updateIntersection();
	}

	function handleDragOver(ev) {
		updatePointerFromMouseEvent(ev);
		sceneState.raycaster.setFromCamera(sceneState.pointer,sceneState.camera);
		updateIntersection();

		if (onDragOver)
			onDragOver(ev);
	}

	let animate=useCallback(()=>{
		//console.log("animate...");

		if (onFrame)
			onFrame();

		sceneState.renderer.setClearColor(0x000000,0);

		if (camera)
			sceneState.camera=camera;

		if (!sceneState.camera)
			sceneState.camera=new THREE.PerspectiveCamera();

		let el=domRef.current;
		if (el.clientWidth<el.clientHeight)
			sceneState.camera.zoom=el.clientWidth/el.clientHeight;

		sceneState.camera.aspect=el.clientWidth/el.clientHeight;
		sceneState.camera.updateProjectionMatrix();
		sceneState.renderer.setSize(el.clientWidth,el.clientHeight);

		sceneState.raycaster.setFromCamera(sceneState.pointer,sceneState.camera);
		updateIntersection();

		sceneState.renderer.render(sceneState.scene,sceneState.camera);
	},[]);

	useLayoutEffect(()=>{
		domRef.current.appendChild(sceneState.renderer.domElement);
		if (!sceneState.nodeRefCalled && nodeRef) {
			nodeRef(sceneState.scene,sceneState.renderer,animate);
		}

		return (()=>{
			domRef.current.removeChild(sceneState.renderer.domElement);
		});
	},[]);

	useLayoutEffect(()=>{
		if (animationLoop)
			sceneState.renderer.setAnimationLoop(animate);

		return (()=>{
			sceneState.renderer.setAnimationLoop(null);
		});
	},[animationLoop]);

	useLayoutEffect(()=>{
		if (!animationLoop)
			animate();
	});

	useResizeObserver(domRef,()=>{
		if (!animationLoop)
			animate();
	});

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
