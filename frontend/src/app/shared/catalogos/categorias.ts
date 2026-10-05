export const CATEGORIAS_PRODUCTO = [
	"Accesorios",
	"Accesorios iPad",
	"Accesorios iPhone",
	"Accesorios iWatch",
	"Accesorios MacBook",
	"Accesorios Pencil",
	"Adaptadores",
	"AirTag",
	"Audio",
	"Cables",
	"Cargadores",
	"Hub USB",
	"Maletín",
	"Organizadores",
	"Pencil",
	"STAND",
	"Teclados",
] as const;

export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];
