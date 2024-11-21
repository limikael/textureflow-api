/*export function createNodeInfo(threeNode, indexPath, labelByMaterial) {
	let infoNode={
		type: threeNode.type,
		labels: []
	};

	if (threeNode.material && !Array.isArray(threeNode.material)) {
		infoNode.labels.push(labelByMaterial.get(threeNode.material));
		infoNode.color=threeNode.material.color;

		//console.log(threeNode.material);
	}

	if (threeNode.name)
		infoNode.name=threeNode.name;

	else
		infoNode.name=threeNode.type+" "+(1+indexPath[indexPath.length-1]);

	if (threeNode.type=="Mesh" && Array.isArray(threeNode.material)) {
		infoNode.children=threeNode.material.map((m,i)=>{
			let p=[...indexPath,i];
			let n={type: "FaceGroup", material: m};
			return createNodeInfo(n,p,labelByMaterial);
		});
	}

	else if (threeNode.children) {
		infoNode.children=threeNode.children.map((n,i)=>{
			return createNodeInfo(n,[...indexPath,i],labelByMaterial);
		});
	}

	return infoNode;
}*/
