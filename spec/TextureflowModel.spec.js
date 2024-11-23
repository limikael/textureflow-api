import {TextureflowModel} from "../src/textureflow/TextureflowModel.js";
import {textureflowModelFromCollada} from "../src/textureflow/textureflow-util.js";
import {getFileObject} from "../src/utils/fs-util.js";
import fs from "fs";
import {DOMParser} from "xmldom";
import {treeForEach} from "../src/utils/tree-util.js";

globalThis.DOMParser=DOMParser;

describe("TextureflowModel",()=>{
	it("can process collada",async ()=>{
		let data=fs.readFileSync("spec/data/house.dae","utf8");
		let model=textureflowModelFromCollada(data);

		console.log(model);
	});

	/*it("can be imported",async ()=>{
		let textureflowModel=new TextureflowModel();

		let file=await getFileObject("spec/data/house.dae",{fs});
		await textureflowModel.import(URL.createObjectURL(file),{});

		//console.log(textureflowModel.getFacePaths("0/0"));
	});*/

	/*it("can be imported",async ()=>{
		let textureflowModel=new TextureflowModel();

		let file=await getFileObject("spec/data/Jungle.OS.noimg.dae",{fs});
		await textureflowModel.import(URL.createObjectURL(file),{});

		treeForEach(textureflowModel.model,(node,indexPath)=>{
			console.log(indexPath.join("/")+": "+node.name);
		})

		//console.log("name: "+textureflowModel.model.name);
	});*/
});