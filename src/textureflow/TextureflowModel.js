import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {loaderPromise, loaderParsePromise, threeUniqueMaterials} from "../utils/three-util.js";
import * as THREE from 'three';
import {treeForEach, treeNodeByIndexPath, treeSplitIndexPath, treeLeafIndexPaths, treePathBasename, treePathDirname} from "../utils/tree-util.js";
import urlJoin from "url-join";
import {MaterialLibrary} from "./MaterialLibrary.js";
import {createNodeInfo} from "./textureflow-util.js";
import {arrayUnique} from "../utils/js-util.js";
import UvUnwrap from "../utils/UvUnwrap.js";

export class TextureflowModel extends EventTarget {
	constructor() {
		super();

		this.materialLibrary=new MaterialLibrary();
		this.materialLibrary.addEventListener("materialLoaded",this.handleMaterialLoaded);
		this.hidden=[];

		this.loadingMaterial=new THREE.MeshBasicMaterial({color: 0xff0000});

		this.invisibleMaterial=new THREE.MeshBasicMaterial({color: 0xffffff});
		this.invisibleMaterial.transparent=true;
		this.invisibleMaterial.opacity=0;

		this.selectionMaterial=new THREE.MeshBasicMaterial({color: 0x4093ea});
		this.selectionMaterial.transparent=true;
		this.selectionMaterial.opacity=0.5;
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

		console.log("num face paths: "+this.getFacePaths().length);

		for (let facePath of this.getFacePaths())
			this.initFaceInfo(facePath,labelByMaterial);

		//throw new Error("wip");

		this.setLoadingState(false);
	}

	async parse(modelData, options={}) {
		this.setLoadingState(true);

		if (options.initMaterialLibrary===undefined)
			options.initMaterialLibrary=true;

		if (options.initMaterialLibrary)
			await this.materialLibrary.init();

		let loader=new THREE.ObjectLoader();
		this.model=await loaderParsePromise(loader,modelData);

		this.box=new THREE.Box3();
		this.box.expandByObject(this.model);

		for (let facePath of this.getFacePaths())
			this.updateFace(facePath);

		this.setLoadingState(false);
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

	handleMaterialLoaded=(ev)=>{
		//console.log("handle material loaded: "+ev.materialName);

		for (let facePath of this.getFacePaths()) {
			let faceInfo=this.getFaceInfo(facePath);
			if (faceInfo.materialName==ev.materialName)
				this.updateFace(facePath);
		}
	}

	createNodeSelectionClone(node, faceGroupIndex) {
		let cloneNode=node.clone();

		if (Array.isArray(cloneNode.material)) {
			cloneNode.material.fill(this.invisibleMaterial);
			cloneNode.material[faceGroupIndex]=this.selectionMaterial;
		}

		else {
			cloneNode.material=this.selectionMaterial;
		}

		return cloneNode;
	}

	createSelectionClone(selectionNodePaths) {
		let selectionClone=new THREE.Group();
		treeForEach(this.model,(node,indexPath)=>{
			if (node.type!="Mesh")
				return;

			let nodePath=indexPath.join("/");

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

	getLabels() {
		let labels=[];
		for (let facePath of this.getFacePaths())
			labels.push(...this.getFaceInfo(facePath).labels);

		return arrayUnique(labels);
	}

	getFacePathsByLabel(label) {
		let facePaths=[];
		for (let facePath of this.getFacePaths())
			if (this.getFaceInfo(facePath).labels.includes(label))
				facePaths.push(facePath);

		return facePaths;
	}

	getFacePaths(parentNodePath) {
		let indexPath=treeSplitIndexPath(parentNodePath);
		let res=[];
		let parent=treeNodeByIndexPath(this.model,indexPath);
		treeForEach(parent,(threeNode,nodeIndexPath)=>{
			if (threeNode.type=="Mesh") {
				if (threeNode.children.length)
					throw new Error("A mesh with children?");

				if (Array.isArray(threeNode.material)) {
					for (let mi=0; mi<threeNode.material.length; mi++)
						res.push([...indexPath,...nodeIndexPath,mi].join("/"))
				}

				else {
					res.push([...indexPath,...nodeIndexPath].join("/"))
				}
			}
		});

		return res;
	}

	getMeshFacePath(facePath) {
		let parentPath=treePathDirname(facePath);
		let parentNode=treeNodeByIndexPath(this.model,parentPath);

		if (parentNode.type=="Mesh")
			return parentPath;

		return facePath;
	}

	getModelFaceMaterial(facePath) {
		let meshFacePath=this.getMeshFacePath(facePath);

		if (meshFacePath==facePath) {
			let node=treeNodeByIndexPath(this.model,facePath);
			return node.material;
		}

		let parentNode=treeNodeByIndexPath(this.model,meshFacePath);
		let materialIndex=treePathBasename(facePath);

		return parentNode.material[materialIndex];
	}

	getFaceInfo(facePath) {
		let meshFacePath=this.getMeshFacePath(facePath);

		if (meshFacePath==facePath) {
			let node=treeNodeByIndexPath(this.model,facePath);
			if (node.type!="Mesh")
				throw new Error("Should be a mesh");

			if (!node.userData.faceInfo)
				node.userData.faceInfo={};

			return node.userData.faceInfo;
		}

		else {
			let parentNode=treeNodeByIndexPath(this.model,meshFacePath);
			if (parentNode.type!="Mesh")
				throw new Error("parent is not mesh");

			let materialIndex=treePathBasename(facePath);

			if (!parentNode.userData.faceInfo)
				parentNode.userData.faceInfo=[];

			if (!parentNode.userData.faceInfo[materialIndex])
				parentNode.userData.faceInfo[materialIndex]={};

			return parentNode.userData.faceInfo[materialIndex];
		}
	}

	updateFaceInfo(facePath, newFaceInfo) {
		let faceInfo=this.getFaceInfo(facePath);
		Object.assign(faceInfo,newFaceInfo);
		this.updateFace(facePath);
		this.dispatchEvent(new Event("change"));
		this.dispatchEvent(new Event("modelChange"));
	}

	getFaceData(facePath) {
		let node=treeNodeByIndexPath(this.model,facePath);
		if (node.type!="Mesh")
			throw new Error("Should be a mesh");

		if (!node.faceData)
			node.faceData={};

		return node.faceData;
	}

	initFaceInfo(facePath, labelByMaterial) {
		//console.log("init face info: "+facePath);

		let faceInfo=this.getFaceInfo(facePath);
		let material=this.getModelFaceMaterial(facePath);

		faceInfo.color=material.color;
		faceInfo.labels=[];

		if (material)
			faceInfo.labels.push(labelByMaterial.get(material));
	}

	updateFaceData(facePath) {
		let faceData=this.getFaceData(facePath);
		let faceInfo=this.getFaceInfo(facePath);

		if (!faceData.textureMaterial) {
			let texture=new THREE.Texture();
			texture.wrapS=THREE.RepeatWrapping;
			texture.wrapT=THREE.RepeatWrapping;
			texture.repeat.set(1,1);

			faceData.textureMaterial=new THREE.MeshStandardMaterial( { map:texture } );
		}

		if (!faceData.colorMaterial)
			faceData.colorMaterial=new THREE.MeshPhongMaterial({color: faceInfo.color, specular: 0xffffff});

		if (faceInfo.materialName) {
			let libraryMaterial=this.materialLibrary.getMaterial(faceInfo.materialName);
			if (libraryMaterial.image && 
					libraryMaterial.image!=faceData.textureMaterial.map.image) {
				faceData.textureMaterial.map.image=libraryMaterial.image;
				faceData.textureMaterial.map.needsUpdate=true;
			}
		}

		else {
			if (faceData.textureMaterial.map.image) {
				faceData.textureMaterial.map.image=null;
				faceData.textureMaterial.map.needsUpdate=true;
			}
		}

		let textureRotation=faceInfo.textureRotation;
		if (!textureRotation)
			textureRotation=0;

		faceData.textureMaterial.map.rotation=2*Math.PI*textureRotation/360;

		let textureScale=faceInfo.textureScale;
		if (!textureScale)
			textureScale=1;

		faceData.textureMaterial.map.repeat.set(1/textureScale,1/textureScale);
	}

	getFaceMaterial(facePath) {
		let faceInfo=this.getFaceInfo(facePath);
		let faceData=this.getFaceData(facePath);

		if (this.hidden.includes(facePath))
			return this.invisibleMaterial;

		if (faceInfo.materialName) {
			if (faceData.textureMaterial.map.image)
				return faceData.textureMaterial;

			return this.loadingMaterial;
		}

		return faceData.colorMaterial;
	}

	updateFace(facePath) {
		this.updateFaceData(facePath);

		let threeNode=treeNodeByIndexPath(this.model,facePath);
		if (threeNode.type!="Mesh")
			throw new Error("Expected mesh");

		let faceInfo=this.getFaceInfo(facePath);
		if (faceInfo.materialName && !faceInfo.uvCalculated)
			this.calculateUvCoords(facePath);

		threeNode.material=this.getFaceMaterial(facePath);
	}

	calculateUvCoords(nodePath) {
		console.log("compute: "+nodePath);

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

		let faceInfo=this.getFaceInfo(nodePath);
		faceInfo.uvCalculated=true;
	}

	setHidden(hidden) {
		this.hidden=hidden;
		for (let facePath of this.getFacePaths())
			this.updateFace(facePath);

		this.dispatchEvent(new Event("change"));
	}
}
