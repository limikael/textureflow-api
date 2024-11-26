import {createQqlClient} from "qql";
import urlJoin from "url-join";
import * as THREE from 'three';
import {loaderPromise} from "../utils/three-util.js";
import {ResolvablePromise} from "../utils/js-util.js";

export class LibraryMaterial {
	constructor(materialName, materialLibrary) {
		this.materialName=materialName;
		this.materialLibrary=materialLibrary;

		this.load();
	}

	async load() {
		await this.materialLibrary.init();

		this.materialInfo=this.materialLibrary.materialInfoByName[this.materialName];

		let url=urlJoin(this.materialLibrary.baseUrl,"/admin/_content",this.materialInfo.texture);
		//console.log("loading material: "+this.materialInfo.name+" url="+url);

		let imageLoader=new THREE.ImageLoader();
		this.image=await loaderPromise(imageLoader,url);

		//console.log(this.image);

		this.materialLibrary.notifyMaterialLoaded(this.materialInfo.name);
	}
}

export class MaterialLibrary extends EventTarget {
	constructor() {
		super();

		if (globalThis.window)
			this.baseUrl=globalThis.window.location.origin;

		//this.baseUrl="http://localhost:3000/";
		//this.baseUrl="https://textureflow.io/";

		this.libraryMaterials={};
	}

	async init() {
		if (this.initPromise)
			return await this.initPromise;

		this.initPromise=new ResolvablePromise();

		console.log("init material library");
		let qql=createQqlClient(urlJoin(this.baseUrl,"admin/_qql"));
		let materialInfos=await qql({
			manyFrom: "materials"
		});

		this.materialInfoByName=Object.fromEntries(materialInfos.map(m=>[m.name,m]));
		this.initPromise.resolve();
		console.log("material initialized");
	}

	getMaterialInfo(materialName) {
		let info=this.materialInfoByName[materialName];

		info.thumbUrl=urlJoin(this.baseUrl,"admin/_content",info.thumb);
		return info;
	}

	getMaterial(materialName) {
		if (!this.libraryMaterials[materialName])
			this.libraryMaterials[materialName]=new LibraryMaterial(materialName,this);

		return this.libraryMaterials[materialName];
	}

	notifyMaterialLoaded(materialName) {
		//console.log("material loaded: "+materialName);
		let e=new Event("materialLoaded");
		e.materialName=materialName;
		this.dispatchEvent(e);
	}
}
