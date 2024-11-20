import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {loaderPromise, loaderParsePromise, threeUniqueMaterials} from "../utils/three-util.js";
import * as THREE from 'three';
import {treeForEach, treeNodeByIndexPath, treeSplitIndexPath, treeLeafIndexPaths} from "../utils/tree-util.js";
import urlJoin from "url-join";
import {MaterialLibrary} from "./MaterialLibrary.js";
import {createNodeInfo} from "./textureflow-util.js";
import {arrayUnique} from "../utils/js-util.js";
import UvUnwrap from "../utils/UvUnwrap.js";

export class TextureflowModel extends EventTarget {
	constructor() {
		super();
		//this.url=url;
		this.materialLibrary=new MaterialLibrary();
		this.materialLibrary.addEventListener("materialLoaded",this.handleMaterialLoaded);
		this.hidden=[];
		//this.nodeInfoMaterials={};

		this.loadingMaterial=new THREE.MeshBasicMaterial({color: 0xff0000});

		this.invisibleMaterial=new THREE.MeshBasicMaterial({color: 0xffffff});
		this.invisibleMaterial.transparent=true;
		this.invisibleMaterial.opacity=0;
	}

	async import(url, options={}) {
		this.setLoadingState(true);

		if (options.initMaterialLibrary===undefined)
			options.initMaterialLibrary=true;

		if (options.initMaterialLibrary)
			await this.materialLibrary.init();

		let loader=new ColladaLoader();
		let urlText=await (await fetch(url)).text();
		let modelData=loader.parse(urlText);

		this.model=modelData.scene;

		this.box=new THREE.Box3();
		this.box.expandByObject(this.model);

		let labelByMaterial=new Map();
		let index=1;
		for (let material of threeUniqueMaterials(this.model)) {
			labelByMaterial.set(material,"Material "+index);
			index++;
		}

		this.nodeInfo=createNodeInfo(this.model,[],labelByMaterial);
		this.nodeData={};

		this.setLoadingState(false);
	}

	async parse(project) {
		this.setLoadingState(true);

		await this.materialLibrary.init();

		let loader=new THREE.ObjectLoader();
		this.model=await loaderParsePromise(loader,project.model);

		this.box=new THREE.Box3();
		this.box.expandByObject(this.model);

		this.nodeInfo=project.nodeInfo;
		this.nodeData={};

		for (let nodePath of this.getLeafNodePaths())
			this.updateNode(nodePath);

		this.setLoadingState(false);
	}

	setLoadingState(loadingState) {
		this.loadingState=loadingState;
		this.dispatchEvent(new Event("change"));
	}

	getBox() {
		return this.box;
	}

	getLoadingStatus() {
		if (this.loading)
			return "loading";

		if (!this.model)
			return "none";

		return "complete";
	}

	updateNodeData(nodePath) {
		if (!this.nodeData[nodePath])
			this.nodeData[nodePath]={};

		let nodeData=this.nodeData[nodePath];
		let nodeInfo=treeNodeByIndexPath(this.nodeInfo,nodePath);

		if (!nodeData.textureMaterial) {
			let texture=new THREE.Texture();
			texture.wrapS=THREE.RepeatWrapping;
			texture.wrapT=THREE.RepeatWrapping;
			texture.repeat.set(1,1);

			nodeData.textureMaterial=new THREE.MeshStandardMaterial( { map:texture } );
		}

		if (!nodeData.colorMaterial)
			nodeData.colorMaterial=new THREE.MeshPhongMaterial({color: nodeInfo.color, specular: 0xffffff});

		if (nodeInfo.materialName) {
			let libraryMaterial=this.materialLibrary.getMaterial(nodeInfo.materialName);
			if (libraryMaterial.image && 
					libraryMaterial.image!=nodeData.textureMaterial.map.image) {
				nodeData.textureMaterial.map.image=libraryMaterial.image;
				nodeData.textureMaterial.map.needsUpdate=true;
			}
		}

		else {
			if (nodeData.textureMaterial.map.image) {
				nodeData.textureMaterial.map.image=null;
				nodeData.textureMaterial.map.needsUpdate=true;
			}
		}

		let textureRotation=nodeInfo.textureRotation;
		if (!textureRotation)
			textureRotation=0;

		nodeData.textureMaterial.map.rotation=2*Math.PI*textureRotation/360;

		let textureScale=nodeInfo.textureScale;
		if (!textureScale)
			textureScale=1;

		nodeData.textureMaterial.map.repeat.set(1/textureScale,1/textureScale);
	}

	getNodeMaterial(nodePath) {
		let nodeInfo=treeNodeByIndexPath(this.nodeInfo,nodePath);
		this.updateNodeData(nodePath);
		let nodeData=this.nodeData[nodePath];

		if (this.hidden.includes(nodePath))
			return this.invisibleMaterial;

		if (nodeInfo.materialName) {
			if (nodeData.textureMaterial.map.image)
				return nodeData.textureMaterial;

			return this.loadingMaterial;
		}

		return nodeData.colorMaterial;
	}

	updateNode(nodePath) {
		let indexPath=nodePath.split("/");
		let nodeInfo=treeNodeByIndexPath(this.nodeInfo,indexPath);
		let threeNode;
		let material;

		switch (nodeInfo.type) {
			case "Mesh":
				threeNode=treeNodeByIndexPath(this.model,indexPath);
				material=this.getNodeMaterial(nodePath);
				threeNode.material=material;

				if (material.map &&
						material.map.image &&
						!nodeInfo.uvCalculated)
					this.calculateUvCoords(nodePath);
				break;

			case "FaceGroup":
				throw new Error("FaceGroup is wip");
				/*threeNode=treeNodeByIndexPath(this.model,indexPath.slice(0,indexPath.length-1));
				let materialIndex=indexPath[indexPath.length-1];
				if (this.hidden.includes(nodePath)) {
					threeNode.material[materialIndex]=this.invisibleMaterial;
				}

				else if (nodeInfo.materialName) {
					threeNode.material[materialIndex]=this.getNodeInfoMaterial(nodePath);
				}

				else {
					threeNode.material[materialIndex]=new THREE.MeshPhongMaterial({color: nodeInfo.color, specular: 0xffffff});
				}*/

				break;
		}
	}

	handleMaterialLoaded=(ev)=>{
		console.log("handle material loaded: "+ev.materialName);

		treeForEach(this.nodeInfo,(nodeInfo,indexPath)=>{
			let nodePath=indexPath.join("/");
			if (nodeInfo.materialName==ev.materialName) {
				//console.log("refresh after material load: "+materialName+": "+indexPathname);
				this.updateNode(nodePath);
			}
		});
	}

	setNodeInfo(nodePath, update) {
		let nodeInfo=this.getNodeInfo(nodePath);
		Object.assign(nodeInfo,update);

		this.updateNode(nodePath);
		this.dispatchEvent(new Event("change"));
		this.dispatchEvent(new Event("modelChange"));
	}

	getNodeInfo(nodePath) {
		return treeNodeByIndexPath(this.nodeInfo,nodePath);
	}

	getLabels() {
		let labels=[];

		treeForEach(this.nodeInfo,nodeInfo=>{
			labels.push(...nodeInfo.labels)
		});

		return arrayUnique(labels);
	}

	getNodePathsByLabel(label) {
		let nodePaths=[];

		treeForEach(this.nodeInfo,(nodeInfo,indexPath)=>{
			if (nodeInfo.labels.includes(label))
				nodePaths.push(indexPath.join("/"));
		});

		return nodePaths;
	}

	getLeafNodePaths(parentNodePath) {
		let indexPath=treeSplitIndexPath(parentNodePath);
		let res=[];
		let parent=treeNodeByIndexPath(this.nodeInfo,indexPath);
		treeForEach(parent,(infoNode,nodeIndexPath)=>{
			if (!infoNode.children || !infoNode.children.length)
				res.push([...indexPath,...nodeIndexPath].join("/"))
		});

		return res;
	}

	createNodeSelectionClone(node, faceGroupIndex) {
		let m=new THREE.MeshBasicMaterial({color: 0x4093ea});
		m.transparent=true;
		m.opacity=0.5;

		let cloneNode=node.clone();

		if (Array.isArray(cloneNode.material)) {
			cloneNode.material.fill(this.invisibleMaterial);
			cloneNode.material[faceGroupIndex]=m;
		}

		else {
			cloneNode.material=m;
		}

		return cloneNode;
	}

	getModelExportData() {
		let modelClone=this.model.clone();

		treeForEach(modelClone,threeNode=>{
			if (Array.isArray(threeNode.material))
				threeNode.material.fill();

			else if (threeNode.material)
				threeNode.material=undefined;
		});

		return modelClone;
	}

	createSelectionClone(selectionNodePaths) {
		let selectionClone=new THREE.Group();
		treeForEach(this.model,(node,indexPath)=>{
			//let indexPath=threeIndexPath(this.model,node);
			let nodePath=indexPath.join("/");
			//let indexPathname=indexPath.join("/");

			if (node.type!="Mesh")
				return;

			if (Array.isArray(node.material)) {
				for (let i=0; i<node.material.length; i++) {
					let faceGroupIndexPathname=[...indexPath,i].join("/");
					if (selectionNodePaths.includes(faceGroupIndexPathname) &&
							!this.hidden.includes(faceGroupIndexPathname)) {
						selectionClone.add(this.createNodeSelectionClone(node,i));
					}
				}
			}

			else {
				if (selectionNodePaths.includes(nodePath) &&
						!this.hidden.includes(nodePath)) {
					selectionClone.add(this.createNodeSelectionClone(node));
				}
			}
		});

		return selectionClone;
	}

	calculateUvCoords(nodePath) {
		let node=treeNodeByIndexPath(this.model,nodePath);
		if (node.type!="Mesh")
			throw new Error("Not a mesh!");

		let box=this.getBox();
		let texSize=Math.max(
			box.max.x-box.min.x,
			box.max.y-box.min.y,
			box.max.z-box.min.z
		)/5;

		let positions=Array.from(node.geometry.getAttribute("position").array);
		let uvUnwrap=new UvUnwrap(positions);
		let uvCoords=uvUnwrap.unwrap(texSize);
		let uvArray=new Float32Array(uvCoords);
		let uvAttribute=new THREE.BufferAttribute(uvArray,2);
		node.geometry.setAttribute("uv",uvAttribute);

		let nodeInfo=this.getNodeInfo(nodePath);
		nodeInfo.uvCalculated=true;
	}

	setHidden(hidden) {
		this.hidden=hidden;
		for (let nodePath of this.getLeafNodePaths())
			this.updateNode(nodePath);

		this.dispatchEvent(new Event("change"));
	}
}
