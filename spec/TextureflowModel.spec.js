import {TextureflowModel} from "../src/textureflow/TextureflowModel.js";
import {getFileObject} from "../src/utils/fs-util.js";
import fs from "fs";
import {DOMParser} from "xmldom";

globalThis.DOMParser=DOMParser;

describe("TextureflowModel",()=>{
	it("can be imported",async ()=>{
		let textureflowModel=new TextureflowModel();

		let file=await getFileObject("spec/data/house.dae",{fs});
		await textureflowModel.import(URL.createObjectURL(file),{initMaterialLibrary: false});

		//console.log(textureflowModel.nodeInfo);

		//console.log(textureflowModel.getNodeInfo("0"));

		/*let labels=textureflowModel.getLabels();
		console.log(labels);

		let nodePaths=textureflowModel.getNodePathsByLabel(labels[0]);
		console.log(nodePaths);*/

		textureflowModel.model.userData={hello: "world"};

		let json=textureflowModel.model.toJSON();
		console.log(json.object);
	});
});