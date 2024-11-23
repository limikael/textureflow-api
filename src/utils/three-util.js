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

export function threeCanonicalizeMultiMaterial(model) {
	if (model.material && !Array.isArray(model.material))
		model.material=[model.material];

	for (let child of model.children)
		threeCanonicalizeMultiMaterial(child);
}

export function threeNameNodes(node, index) {
	if (index===undefined)
		index=0;

	if (!node.name)
		node.name=node.type+" "+(index+1);

	for (let i=0; i<node.children.length; i++)
		threeNameNodes(node.children[i],i);
}

export function threeNameMaterials(node) {
	let uniqueMaterials=threeUniqueMaterials(node);
	for (let i=0; i<uniqueMaterials.length; i++) {
		if (!uniqueMaterials[i].name)
			uniqueMaterials[i].name="Material "+(i+1);
	}
}

export function threeExtractUserData(node) {
	let resNode={
		type: node.type,
		userData: JSON.parse(JSON.stringify(node.userData)),
		children: []
	};

	for (let child of node.children)
		resNode.children.push(threeExtractUserData(child));

	return resNode;
}

export function threeApplyUserData(node, nodeWithUserData) {
	if (!node || !nodeWithUserData)
		return;

	if (node.type!=nodeWithUserData.type) {
		console.log("starnge, different types...");
		return;
	}

	node.userData=JSON.parse(JSON.stringify(nodeWithUserData.userData));
	for (let i=0; i<node.children.length; i++)
		threeApplyUserData(node.children[i],nodeWithUserData.children[i]);
}