import {TextureflowModel} from "../src/textureflow/TextureflowModel.js";
import {textureflowModelFromCollada} from "../src/textureflow/textureflow-util.js";
import {getFileObject} from "../src/utils/fs-util.js";
import fs from "fs";
import {DOMParser} from "xmldom";
import {treeForEach} from "../src/utils/tree-util.js";

globalThis.DOMParser=DOMParser;

describe("TextureflowModel",()=>{
	/*it("can process collada",async ()=>{
		let data=fs.readFileSync("spec/data/house.dae","utf8");
		let model=textureflowModelFromCollada(data);

		//console.log(model);
	});*/

	it("can process collada big file",async ()=>{
		let data=fs.readFileSync("spec/data/Jungle.OS.noimg.dae","utf8");
		let model=await textureflowModelFromCollada(data,{
			onProgress: percent=>console.log("processing: "+percent)
		});

		//console.log(model);
	});
});