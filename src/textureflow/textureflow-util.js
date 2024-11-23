import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {threeNameNodes, threeNameMaterials, threeCanonicalizeMultiMaterial} from "../utils/three-util.js";
import * as THREE from 'three';
import {treeForEach} from "../utils/tree-util.js";
import UvUnwrap from "../utils/UvUnwrap.js";

function computeUvCoords(node, texSize) {
	if (node.type!="Mesh")
		throw new Error("Not a mesh!");

	let positions=Array.from(node.geometry.getAttribute("position").array);
	let uvUnwrap=new UvUnwrap(positions);
	let uvCoords=uvUnwrap.unwrap(texSize);
	let uvArray=new Float32Array(uvCoords);
	let uvAttribute=new THREE.BufferAttribute(uvArray,2);
	node.geometry.setAttribute("uv",uvAttribute);
}

export function textureflowModelFromCollada(colladaText) {
	let loader=new ColladaLoader();
	let modelData=loader.parse(colladaText);

	let model=modelData.scene;
	let box=new THREE.Box3();
	box.expandByObject(model);

	threeNameNodes(model);
	threeNameMaterials(model);
	threeCanonicalizeMultiMaterial(model);

	let texSize=Math.max(
		box.max.x-box.min.x,
		box.max.y-box.min.y,
		box.max.z-box.min.z
	)/5;

	treeForEach(model,node=>{
		if (node.type=="Mesh")
			computeUvCoords(node,texSize);
	});

	return model.toJSON();
}