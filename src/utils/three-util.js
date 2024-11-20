import {treeForEach} from "./tree-util.js";

export function loaderPromise(loader, url) {
	return new Promise((resolve, reject)=>{
		loader.load(url,resolve,null,reject);
	});
}

export function loaderParsePromise(loader, data) {
	return new Promise((resolve, reject)=>{
		loader.parse(data,resolve);
	});
}

function compareIntersectionObject(a, b) {
	return (
		(a.distance==b.distance) &&
		(a.point.equals(b.point)) &&
		//(a.face==b.face) &&
		(a.faceIndex==b.faceIndex) &&
		(a.object==b.object)
	);
}

function compareIntersectionArray(a, b) {
	if (a.length!=b.length)
		return false;

	let eq=true;
	for (let i=0; i<a.length; i++)
		eq&&=compareIntersectionObject(a[i],b[i]);

	return eq;
}

export function threeUniqueMaterials(model) {
	let uniqueMaterials=[];
	treeForEach(model,node=>{
		let materials;
		if (Array.isArray(node.material))
			materials=node.material;

		else if (node.material)
			materials=[node.material];

		if (materials)
			for (let m of materials)
				if (uniqueMaterials.indexOf(m)<0)
					uniqueMaterials.push(m);
	});

	return uniqueMaterials;
}