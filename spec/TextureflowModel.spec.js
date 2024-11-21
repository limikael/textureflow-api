import {TextureflowModel} from "../src/textureflow/TextureflowModel.js";
import {getFileObject} from "../src/utils/fs-util.js";
import fs from "fs";
import {DOMParser} from "xmldom";
import {treeForEach} from "../src/utils/tree-util.js";

globalThis.DOMParser=DOMParser;

describe("TextureflowModel",()=>{
	it("can be imported",async ()=>{
		let textureflowModel=new TextureflowModel();

		let file=await getFileObject("spec/data/house.dae",{fs});
		await textureflowModel.import(URL.createObjectURL(file),{initMaterialLibrary: false});

		//console.log(textureflowModel.getFacePaths("0/0"));

		/*let [node,index]=textureflowModel.resolveFacePath("0/0");
		console.log(node);
		console.log(index);*/
	});

	it("can be imported",async ()=>{
		let textureflowModel=new TextureflowModel();

		let file=await getFileObject("spec/data/Jungle.OS.noimg.dae",{fs});
		await textureflowModel.import(URL.createObjectURL(file),{initMaterialLibrary: false});

		treeForEach(textureflowModel.model,(node,indexPath)=>{
			console.log(indexPath.join("/")+": "+node.name);
		})

		//console.log("name: "+textureflowModel.model.name);
	});
});