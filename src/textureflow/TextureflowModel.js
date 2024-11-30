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
import JSZip from "jszip";

export class TextureflowModel extends EventTarget {
	constructor(options={}) {
		super();

		this.materialLibrary=new MaterialLibrary();
		this.materialLibrary.addEventListener("materialLoaded",this.handleMaterialLoaded);

		if (options.materialLibraryBaseUrl)
			this.materialLibrary.baseUrl=options.materialLibraryBaseUrl;

		this.hidden=[];

		this.loadingMaterial=new THREE.MeshBasicMaterial({color: 0x808080});

		this.invisibleMaterial=new THREE.MeshBasicMaterial({color: 0xffffff});
		this.invisibleMaterial.visible=false;

		this.selectionMaterial=new THREE.MeshBasicMaterial({color: 0x4093ea});
		this.selectionMaterial.transparent=true;
		this.selectionMaterial.opacity=0.5;
	}

	async load(options={}) {
		if (this.loading)
			throw new Error("Loading already in progress!");

		//console.log("loading... ",options);
		this.clear();
		this.setLoading(true);

		if (options.unzip) {
			let response=await fetch(options.url);
			let blob=await response.blob();
			let zip=await JSZip.loadAsync(blob);

			let zipFile;
			zip.forEach((_,f)=>zipFile=f);
			console.log("Using unzipped file: "+zipFile.name);

			let modelData=JSON.parse(await zipFile.async("string"));
			await this.parse(modelData,options);
		}

		else {
			let modelData=await (await fetch(options.url)).json();
			await this.parse(modelData,options);
		}
	}

	async parse(jsonData, options={}) {
		this.clear();
		this.setLoading(true);

		if (options.materialLibraryBaseUrl)
			this.materialLibrary.baseUrl=options.materialLibraryBaseUrl;

		await this.materialLibrary.init();

		let loader=new THREE.ObjectLoader();
		this.model=loader.parse(jsonData);
		this.box=new THREE.Box3();
		this.box.expandByObject(this.model);

		threeApplyUserData(this.model,options.userData);

		for (let facePath of this.getFacePaths()) {
			this.initFaceInfo(facePath);
			this.updateFace(facePath);
		}

		this.createCenteredModel();

		this.setLoading(false);
	}

	clear() {
		this.model=null;
		this.centeredModel=null;
	}

	createCenteredModel() {
		let box=this.getBox();

		let boxSize=new THREE.Vector3();
		box.getSize(boxSize);

		let boxCenter=new THREE.Vector3();
		box.getCenter(boxCenter);

		let positionGroup=new THREE.Group();
		positionGroup.position.set(-boxCenter.x,-boxCenter.y + boxSize.y/2,-boxCenter.z);

		let l=boxSize.length();
		let scaleGroup=new THREE.Group();
		scaleGroup.scale.set(1/l,1/l,1/l);

		scaleGroup.add(positionGroup);
		positionGroup.add(this.model);

		this.centeredModel=scaleGroup;
	}

	getModelUserData() {
		let modelUserData=threeExtractUserData(this.model);
		treeForEach(modelUserData,node=>{
			if (node.userData.faceInfo) {
				node.userData.faceInfo=node.userData.faceInfo.map(i=>({
					materialName: i.materialName,
					textureScale: i.textureScale,
					textureRotation: i.textureRotation
				}));
			}
		});

		return modelUserData;
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

		this.dispatchEvent(new Event("change"));
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

		if (!faceInfo.labels)
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

		if (!faceData.colorMaterial)
			faceData.colorMaterial=new THREE.MeshPhongMaterial({
				color: faceInfo.color, 
				opacity: faceInfo.opacity,
				transparent: faceInfo.opacity<=1-Number.EPSILON,
				specular: 0xffffff
			});

		if (faceInfo.materialName) {
			let libraryMaterial=this.materialLibrary.getMaterial(faceInfo.materialName);

			if (!libraryMaterial.material) {
				faceData.assignedMaterialName=null;
				faceData.textureMaterial=null;
			}

			else if (faceData.assignedMaterialName!=faceInfo.materialName) {
				faceData.textureMaterial=libraryMaterial.material.clone();
				faceData.textureMaterial.map=faceData.textureMaterial.map.clone();
				faceData.assignedMaterialName=faceInfo.materialName;
			}
		}

		else {
			faceData.assignedMaterialName=null;
			faceData.textureMaterial=null;
		}

		let textureRotation=faceInfo.textureRotation;
		if (!textureRotation)
			textureRotation=0;

		let textureScale=faceInfo.textureScale;
		if (!textureScale)
			textureScale=1;

		if (faceData.textureMaterial) {
			faceData.textureMaterial.map.rotation=2*Math.PI*textureRotation/360;
			faceData.textureMaterial.map.repeat.set(1/textureScale,1/textureScale);
		}
	}

	updateFace(facePath) {
		this.updateFaceData(facePath);

		let [node,index]=this.resolveFacePath(facePath);
		let faceInfo=this.getFaceInfo(facePath);
		let faceData=this.getFaceData(facePath);

		if (this.hidden.includes(facePath)) {
			node.material[index]=this.invisibleMaterial;
		}

		else if (faceInfo.materialName) {
			if (faceData.textureMaterial)
				node.material[index]=faceData.textureMaterial;

			else
				node.material[index]=this.loadingMaterial;
		}

		else {
			node.material[index]=faceData.colorMaterial;
		}
	}

	setHidden(hidden) {
		this.hidden=hidden;
		for (let facePath of this.getFacePaths())
			this.updateFace(facePath);

		this.dispatchEvent(new Event("change"));
	}

	getExportData() {
		let clonedModel=this.model.clone();
		treeForEach(clonedModel,(node, indexPath)=>{
			if (node.type=="Mesh") {
				for (let i=0; i<node.userData.faceInfo.length; i++) {
					let facePath=[...indexPath,i];
					let faceData=this.getFaceData(facePath);
					node.material[i]=faceData.colorMaterial;
				}
			}
		});

		let exportData=clonedModel.toJSON();
		return exportData;
	}
}
