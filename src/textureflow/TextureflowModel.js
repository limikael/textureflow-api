import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {loaderPromise, loaderParsePromise, threeUniqueMaterials, 
	threeCanonicalizeMultiMaterial, threeNameNodes, 
	threeExtractUserData, threeApplyUserData, threeNameMaterials} from "../utils/three-util.js";
import * as THREE from 'three';
import {treeForEach, treeNodeByIndexPath, treeSplitIndexPath, treeLeafIndexPaths, /*treePathBasename, treePathDirname*/} from "../utils/tree-util.js";
import urlJoin from "url-join";
import {MaterialLibrary} from "./MaterialLibrary.js";
import {arrayUnique, arrayIncludesAll} from "../utils/js-util.js";
import UvUnwrap from "../utils/UvUnwrap.js";

export class TextureflowModel extends EventTarget {
	constructor() {
		super();

		this.materialLibrary=new MaterialLibrary();
		this.materialLibrary.addEventListener("materialLoaded",this.handleMaterialLoaded);
		this.hidden=[];

		this.loadingMaterial=new THREE.MeshBasicMaterial({color: 0x808080});

		this.invisibleMaterial=new THREE.MeshBasicMaterial({color: 0xffffff});
		this.invisibleMaterial.visible=false;

		this.selectionMaterial=new THREE.MeshBasicMaterial({color: 0x4093ea});
		this.selectionMaterial.transparent=true;
		this.selectionMaterial.opacity=0.5;
	}

	async load(url, options={}) {
		this.setLoading(true);

		/*if (options.initMaterialLibrary===undefined)
			options.initMaterialLibrary=true;

		if (options.initMaterialLibrary)
			await this.materialLibrary.init();*/

		let loader=new ColladaLoader();
		let urlText=await (await fetch(url)).text();
		//console.log(urlText);
		let modelData=loader.parse(urlText);

		this.model=modelData.scene;
		this.box=new THREE.Box3();
		this.box.expandByObject(this.model);

		threeNameNodes(this.model);
		threeNameMaterials(this.model);
		threeCanonicalizeMultiMaterial(this.model);
		threeApplyUserData(this.model,options.userData);

		for (let facePath of this.getFacePaths()) {
			this.initFaceInfo(facePath);
			this.updateFace(facePath);
		}

		this.setLoading(false);
	}

	getModelUserData() {
		return threeExtractUserData(this.model);
	}

	setLoading(loading) {
		this.loading=loading;
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

	createSelectionClone(selectedFacePaths) {
		let selectionClone=new THREE.Group();
		for (let facePath of selectedFacePaths) {
			if (!this.hidden.includes(facePath)) {
				let [node,materialIndex]=this.resolveFacePath(facePath);
				if (node) {
					let cloneNode=node.clone();
					cloneNode.material.fill(this.invisibleMaterial);
					cloneNode.material[materialIndex]=this.selectionMaterial;
					selectionClone.add(cloneNode);
				}
			}
		}

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

	getFacePathsByAllLabels(labels) {
		let facePaths=[];
		for (let facePath of this.getFacePaths())
			if (arrayIncludesAll(this.getFaceInfo(facePath).labels,labels))
				facePaths.push(facePath);

		return facePaths;
	}

	getFacePaths(parentNodePath) {
		let indexPath=treeSplitIndexPath(parentNodePath);
		let res=[];

		let [node,index]=this.resolveFacePath(parentNodePath);
		if (node)
			res.push(parentNodePath);

		let parent=treeNodeByIndexPath(this.model,indexPath);
		treeForEach(parent,(threeNode,nodeIndexPath)=>{
			if (threeNode.type=="Mesh") {
				if (threeNode.children.length)
					throw new Error("A mesh with children?");

				for (let mi=0; mi<threeNode.material.length; mi++)
					res.push([...indexPath,...nodeIndexPath,mi].join("/"))
			}
		});

		return res;
	}

	resolveFacePath(facePath) {
		let indexPath=treeSplitIndexPath(facePath);
		if (indexPath.length<2)
			return [];

		let node=treeNodeByIndexPath(this.model,indexPath.slice(0,indexPath.length-1));
		if (node.type!="Mesh")
			return [];

		let materialIndex=indexPath[indexPath.length-1];
		return [node, materialIndex];
	}

	getFaceInfo(facePath) {
		let [node,index]=this.resolveFacePath(facePath);
		if (!node)
			return;

		if (!node.userData.faceInfo)
			node.userData.faceInfo=[];

		if (!node.userData.faceInfo[index])
			node.userData.faceInfo[index]={};

		return node.userData.faceInfo[index];
	}

	initFaceInfo(facePath) {
		let faceInfo=this.getFaceInfo(facePath);
		let [node,materialIndex]=this.resolveFacePath(facePath);
		let material=node.material[materialIndex];
		if (!material)
			throw new Error("No material!");

		faceInfo.name="FaceGroup "+(materialIndex+1);
		faceInfo.labels=[material.name];
		faceInfo.color=material.color;
		faceInfo.opacity=material.opacity;
		if (faceInfo.opacity===undefined)
			faceInfo.opacity=1;
	}

	updateFaceInfo(facePath, newFaceInfo) {
		let faceInfo=this.getFaceInfo(facePath);
		Object.assign(faceInfo,newFaceInfo);
		this.updateFace(facePath);
		this.dispatchEvent(new Event("change"));
		this.dispatchEvent(new Event("modelChange"));
	}

	getFaceData(facePath) {
		let [node,index]=this.resolveFacePath(facePath);
		if (!node)
			return;

		if (!node.faceData)
			node.faceData=[];

		if (!node.faceData[index])
			node.faceData[index]={};

		return node.faceData[index];
	}

	updateFaceData(facePath) {
		let faceData=this.getFaceData(facePath);
		let faceInfo=this.getFaceInfo(facePath);

		if (!faceData.textureMaterial) {
			let texture=new THREE.Texture();
			texture.wrapS=THREE.RepeatWrapping;
			texture.wrapT=THREE.RepeatWrapping;
			texture.repeat.set(1,1);

			faceData.textureMaterial=new THREE.MeshStandardMaterial({
				map: texture,
				opacity: faceInfo.opacity,
				transparent: faceInfo.opacity<=1-Number.EPSILON,
			});
		}

		if (!faceData.colorMaterial)
			faceData.colorMaterial=new THREE.MeshPhongMaterial({
				color: faceInfo.color, 
				opacity: faceInfo.opacity,
				transparent: faceInfo.opacity<=1-Number.EPSILON,
				specular: 0xffffff
			});

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

	updateFace(facePath) {
		//console.log("update face: "+facePath);

		this.updateFaceData(facePath);

		let [node,index]=this.resolveFacePath(facePath);
		let faceInfo=this.getFaceInfo(facePath);
		let faceData=this.getFaceData(facePath);

		this.updateUvCoords(node);

		if (this.hidden.includes(facePath)) {
			node.material[index]=this.invisibleMaterial;
		}

		else if (faceInfo.materialName) {
			if (faceData.textureMaterial.map.image)
				node.material[index]=faceData.textureMaterial;

			else
				node.material[index]=this.loadingMaterial;
		}

		else {
			node.material[index]=faceData.colorMaterial;
		}
	}

	updateUvCoords(node) {
		let needUv=false;
		for (let nodeFaceInfo of node.userData.faceInfo)
			if (nodeFaceInfo && nodeFaceInfo.materialName)
				needUv=true;

		if (needUv && !node.uvAssigned) {
			this.calculateUvCoords(node);
		}

		if (!needUv) {
			delete node.userData.uvCoords;
			node.uvAssigned=false;
		}
	}

	calculateUvCoords(node) {
		if (node.type!="Mesh")
			throw new Error("Not a mesh!");

		let box=this.getBox();
		let texSize=Math.max(
			box.max.x-box.min.x,
			box.max.y-box.min.y,
			box.max.z-box.min.z
		)/5;

		if (!node.userData.uvCoords) {
			//console.log("computing uv for: "+node.name);
			let positions=Array.from(node.geometry.getAttribute("position").array);
			let uvUnwrap=new UvUnwrap(positions);
			node.userData.uvCoords=uvUnwrap.unwrap(texSize);
		}

		//console.log("assigning uv for: "+node.name);
		let uvArray=new Float32Array(node.userData.uvCoords);
		let uvAttribute=new THREE.BufferAttribute(uvArray,2);
		node.geometry.setAttribute("uv",uvAttribute);
		node.uvAssigned=true;
	}

	setHidden(hidden) {
		this.hidden=hidden;
		for (let facePath of this.getFacePaths())
			this.updateFace(facePath);

		this.dispatchEvent(new Event("change"));
	}
}
