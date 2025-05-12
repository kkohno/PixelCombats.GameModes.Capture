import { Color } from 'pixel_combats/basic';
import { Teams } from 'pixel_combats/room';

export const RED_TEAM_NAME = "Red";
export const BLUE_TEAM_NAME = "Blue";
export const RED_TEAM_DISPLAY_NAME = "Teams/Red";
export const BLUE_TEAM_DISPLAY_NAME = "Teams/Blue";
export const BLUE_TEAM_SPAWN_POINTS_GROUP = 1;
export const RED_TEAM_SPAWN_POINTS_GROUP = 2;
export const RED_TEAM_COLOR = new Color(1, 0, 0);
export const BLUE_TEAM_COLOR = new Color(0, 0, 1);

export function create_team_red() {
    Teams.Add(RED_TEAM_NAME, RED_TEAM_DISPLAY_NAME, RED_TEAM_COLOR);
    Teams.Get(RED_TEAM_NAME).Spawns.SpawnPointsGroups.Add(RED_TEAM_SPAWN_POINTS_GROUP);
    return Teams.Get(RED_TEAM_NAME);
}

export function create_team_blue() {
    Teams.Add(BLUE_TEAM_NAME, BLUE_TEAM_DISPLAY_NAME, BLUE_TEAM_COLOR);
    Teams.Get(BLUE_TEAM_NAME).Spawns.SpawnPointsGroups.Add(BLUE_TEAM_SPAWN_POINTS_GROUP);
    return Teams.Get(BLUE_TEAM_NAME);
}