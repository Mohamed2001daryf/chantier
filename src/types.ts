export interface Block {
  id: number;
  name: string;
  zone: string;
  description: string;
}

export interface Floor {
  id: number;
  block_id: number;
  block_name?: string;
  name: string;
  order_number: number;
  surface_totale_dalle?: number;
}

export interface VerticalElement {
  id: number;
  block_id: number;
  block_name?: string;
  floor_id: number;
  floor_name?: string;
  type: 'Poteaux' | 'Voiles' | 'Voiles périphériques';
  name: string;
  axes: string;
  ferraillage_status: string;
  coffrage_status: string;
  coulage_status: string;
}

export interface Slab {
  id: number;
  block_id: number;
  block_name?: string;
  floor_id: number;
  floor_name?: string;
  name: string;
  axes: string;
  surface: number;
  start_date?: string;
  end_date?: string;
  status: string;
  coffrage_status: string;
  ferraillage_inf_status: string;
  pose_gaine_status: string;
  pose_cable_status: string;
  renforcement_status: string;
  coulage_status: string;
  ratio?: number;
  volume_beton?: number;
  poids_acier?: number;
  task_id?: number; // Linked task from Planning
  surface_coulee?: number;
}

export interface Task {
  id: number;
  block_id: number | null;
  block_name?: string;
  floor_id: number | null;
  floor_name?: string;
  element: string;
  description: string;
  start_date: string;
  end_date: string;
  duration: number;
  status: 'Non commencé' | 'En cours' | 'Terminé';
  element_id?: number;
  element_type?: string;
  slab_id?: number;
  axes?: string;
  surface?: number;
  team_id?: number;
  team_name?: string;
  percentage?: number;
}

export interface ElementType {
  id: number;
  user_id: string;
  name: string;
  category: 'suivi' | 'planning' | 'les deux';
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  speciality: string;
  block_id: number | null;
  block_name?: string;
  workers: number;
}

export interface ProductivityRecord {
  id: number;
  block_id: number;
  block_name?: string;
  team_id: number;
  team_name?: string;
  task_id?: number;
  task_name?: string;
  work_type: string;
  workers_count: number;
  quantity_realized: number;
  date: string;
}

export interface DashboardStats {
  kpis: {
    globalProgress: number;
    elementsCompleted: number;
    delayedTasks: number;
    elementsInProgress: number;
  };
  taskStatusPie: {
    not_started: number;
    started: number;
    completed: number;
  };
  progressByBlock: {
    name: string;
    progress: number;
  }[];
  progressByElementType: {
    all: { type: string; progress: number }[];
    byBlock: Record<string, { type: string; progress: number }[]>;
  };
  delayedTasksList: {
    id: number;
    name: string;
    block: string;
    joursRetard: number;
  }[];
  progressByFloor: {
    id: number;
    floorName: string;
    blockName: string;
    elements: { type: string; done: number; total: number; isSurface?: boolean }[];
  }[];
  teamProductivity: {
    block: string;
    team: string;
    workers: number;
    completed: number;
    assigned: number;
    productivity: number;
  }[];
  progressOverTime: {
    date: string;
    globalProgress: number;
  }[];
  slabsDetail: {
    id: number;
    name: string;
    axes: string;
    blockId: number;
    blockName: string;
    floorId: number;
    floorName: string;
    surface: number;
    surface_coulee: number;
    pct: number;
    coffrage_status: string;
    ferraillage_inf_status: string;
    pose_gaine_status: string;
    pose_cable_status: string;
    renforcement_status: string;
    coulage_status: string;
    start_date: string;
    end_date: string;
    order_number: number;
  }[];
}
