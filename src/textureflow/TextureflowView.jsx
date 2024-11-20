export function TextureflowView({textureflowModel}) {
	useEventUpdate(textureflowModel,"change");

	return (
		<Node value={textureflowModel.model}/>
	);
}