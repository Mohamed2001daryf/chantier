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
  globalProgress: number;
  activeWorkers: number;
  delayedTasks: number;
  totalBlocks: number;
  totalFloors: number;
  totalElements: number;
  taskStatusCounts: { status: string; count: number }[];
  progressByBlock: { name: string; progress: number }[];
  progressByZone: { name: string; progress: number }[];
  weeklyProgress: { name: string; completed: number }[];
  teamProductivity: { 
    block: string; 
    team: string; 
    workers: number; 
    completed: number; 
    assigned: number; 
    productivity: number 
  }[];
  progressByElementType: {
    all: { type: string; progress: number }[];
    byBlock: Record<string, { type: string; progress: number }[]>;
  };
  delayedTasksList: { element: string; block: string; delay: number }[];
  workforceDistribution: { name: string; workers: number }[];
  progressByFloor: { 
    floorName: string; 
    order_number: number;
    elements: { type: string; progress: number }[] 
  }[];
}
