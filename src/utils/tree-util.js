import {objectifyArgs} from "./js-util.js";

/*export function treePathBasename(pathname) {
	let split=treeSplitIndexPath(pathname);

	return split[split.length-1];
}

export function treePathDirname(pathname) {
	let split=treeSplitIndexPath(pathname);

	return split.slice(0,split.length-1).join("/");
}*/

export function treeSplitIndexPath(pathname) {
	if (Array.isArray(pathname))
		return pathname;

	if (!pathname)
		return [];

	return pathname.split("/").map(n=>Number(n));
}

export function treeForEach(node, ...args) {
	let {fn, getChildren, indexPath}=objectifyArgs(args,["fn"]);

	if (!node)
		return;

	if (!getChildren)
		getChildren=parent=>parent.children;

	if (!indexPath)
		indexPath=[];

	let children=node;
	if (!Array.isArray(node)) {
		fn(node,indexPath);
		children=getChildren(node);
	}

	if (!children)
		return;

	for (let i=0; i<children.length; i++)
		treeForEach(children[i],{
			getChildren,
			fn,
			indexPath: [...indexPath,i]
		});
}

export function treeNodeByIndexPath(node, ...args) {
	let {getChildren, indexPath}=objectifyArgs(args,["indexPath"]);

	if (!getChildren)
		getChildren=parent=>parent.children;

	indexPath=treeSplitIndexPath(indexPath);
	if (!indexPath.length)
		return node;

	let children=node;
	if (!Array.isArray(children))
		children=getChildren(children);

	return treeNodeByIndexPath(children[indexPath[0]],indexPath.slice(1));
}

export function treeLeafIndexPaths(tree, indexPath) {
	indexPath=treeSplitIndexPath(indexPath);
	let res=[];
	let parent=treeNodeByIndexPath(tree,indexPath);

	treeForEach(parent,(infoNode,nodeIndexPath)=>{
		if (!infoNode.children || !infoNode.children.length)
			res.push([...indexPath,...nodeIndexPath].join("/"))
	});

	return res;
}
