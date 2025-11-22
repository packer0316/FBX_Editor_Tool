declare module 'three/examples/jsm/loaders/FBXLoader' {
    import { Loader, LoadingManager, Group } from 'three';
    export class FBXLoader extends Loader {
        constructor(manager?: LoadingManager);
        load(url: string, onLoad: (object: Group) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): void;
        parse(FBXBuffer: ArrayBuffer | string, path: string): Group;
    }
}

declare module 'three/examples/jsm/exporters/GLTFExporter' {
    import { Object3D } from 'three';
    export class GLTFExporter {
        constructor();
        parse(input: Object3D | Object3D[], onCompleted: (gltf: ArrayBuffer | { [key: string]: any }) => void, onError: (error: ErrorEvent) => void, options?: { [key: string]: any }): void;
    }
}

declare module 'three/examples/jsm/loaders/TGALoader' {
    import { Loader, LoadingManager, Texture } from 'three';
    export class TGALoader extends Loader {
        constructor(manager?: LoadingManager);
        load(url: string, onLoad: (texture: Texture) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): void;
    }
}
