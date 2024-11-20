import {createQqlClient} from "qql";
import urlJoin from "url-join";
import * as THREE from 'three';
import {loaderPromise} from "../utils/three-util.js";

export class LibraryMaterial {
	constructor(materialInfo, materialLibrary) {
		this.materialInfo=materialInfo;
		this.materialLibrary=materialLibrary;
	}

	async load() {
		//await new Promise(r=>setTimeout(r,1000));

		let url=urlJoin(this.materialLibrary.baseUrl,"/admin/_content",this.materialInfo.texture);
		console.log("loading material: "+this.materialInfo.name+" url="+url);

		let imageLoader=new THREE.ImageLoader();
		this.image=await loaderPromise(imageLoader,url);

		//console.log(this.image);

		this.materialLibrary.notifyMaterialLoaded(this.materialInfo.name);
	}
}

export class MaterialLibrary extends EventTarget {
	constructor() {
		super();
		this.baseUrl="http://localhost:3000/";
		//this.baseUrl="https://textureflow.io/";
	}

	async init() {
		console.log("init material library");
		let qql=createQqlClient(urlJoin(this.baseUrl,"admin/_qql"));
		let materialInfos=await qql({
			manyFrom: "materials"
		});

		this.materialInfoByName=Object.fromEntries(materialInfos.map(m=>[m.name,m]));
		this.libraryMaterials={};
	}

	getMaterial(materialName) {
		if (!this.materialInfoByName[materialName])
			throw new Error("unknown material: "+materialName);

		if (!this.libraryMaterials[materialName]) {
			let m=new LibraryMaterial(this.materialInfoByName[materialName],this);
			m.load();
			this.libraryMaterials[materialName]=m;
		}

		return this.libraryMaterials[materialName];
	}

	notifyMaterialLoaded(materialName) {
		//console.log("material loaded: "+materialName);
		let e=new Event("materialLoaded");
		e.materialName=materialName;
		this.dispatchEvent(e);
	}
}