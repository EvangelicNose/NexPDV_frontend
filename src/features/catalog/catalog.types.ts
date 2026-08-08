export type Category={id:string;name:string;description?:string|null;active:boolean;sortOrder:number;createdAt:string;updatedAt:string}
export type ProductVariant={id:string;name:string;sku?:string|null;barcode?:string|null;priceAdjustment:string;active:boolean}
export type CatalogOption={id:string;name:string;price:string;active:boolean;sortOrder:number}
export type OptionGroup={id:string;name:string;minSelections:number;maxSelections:number;required:boolean;active:boolean;sortOrder?:number;options:CatalogOption[]}
export type ProductPrice={id:string;productVariantId?:string|null;establishmentId?:string|null;amount:string;active:boolean;startsAt?:string|null;endsAt?:string|null}
export type Product={id:string;category?:{id:string;name:string}|null;name:string;description?:string|null;sku?:string|null;barcode?:string|null;basePrice:string;costPrice?:string|null;type:'STANDARD'|'COMBO';active:boolean;trackInventory:boolean;variants:ProductVariant[];optionGroups:OptionGroup[];prices:ProductPrice[];createdAt:string;updatedAt:string}
