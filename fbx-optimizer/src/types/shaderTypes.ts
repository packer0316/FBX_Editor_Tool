// Shader 功能類型定義
export type ShaderFeatureType =
    | 'matcap'
    | 'matcap_add'
    | 'normal_map'
    | 'rim_light'
    | 'dissolve'
    | 'bleach'
    | 'flash'
    | 'alpha_test';

export interface ShaderFeature {
    id: string;
    type: ShaderFeatureType;
    name: string;
    description: string;
    icon: string;
    expanded: boolean;
    params: Record<string, any>;
}

export interface ShaderGroup {
    id: string;
    name: string;
    features: ShaderFeature[];
    selectedMeshes: string[]; // mesh names
    expanded: boolean;
}
