import { Map, AreaService, AreaViewService, AreaPlayerTriggerService, Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote } from 'pixel_combats/room';
import { DisplayValueHeader, Color } from 'pixel_combats/basic';
import * as teams from './default_teams.js';
import * as default_timer from './default_timer.js';

// настройки констант
const WaitingPlayersTime = 10;
const BuildBaseTime = 60;
const GameModeTime = default_timer.game_mode_length_seconds();
const DefPoints = GameModeTime * 0.2;
const EndOfMatchTime = 10;
const DefPointsMaxCount = 30;
const DefTimerTickInderval = 1;
const SavePointsCount = 10;
const RepairPointsBySecond = 0.5;
const CapturePoints = 10;		// макс очков захвата
const MaxCapturePoints = 15;	// макс очков 
const RedCaptureW = 1;		// вес красных при захвате 
const BlueCaptureW = 2;		// вес синих при захвате 
const CaptureRestoreW = 1;	// столько очков отнимается, если нет красных в зоне захвата
const UnCapturedColor = new Color(0, 0, 1, 0);
const FakeCapturedColor = new Color(1, 1, 1, 0); 
const CapturedColor = new Color(1, 0, 0, 0); // к такому цвету стремимся зона, при захвате красных
const MaxSpawnsByArea = 25;	// спавны 

// константы имен, получаемых с объектов режима
const WaitingStateValue = "Waiting";
const BuildModeStateValue = "BuildMode";
const GameStateValue = "Game";
const EndOfMatchStateValue = "EndOfMatch";
const DefAreaTag = "def";
const CaptureAreaTag = "capture";
const HoldPositionHint = "GameModeHint/HoldPosition";
const RunToBliePointHint = "GameModeHint/RunToBliePoint";
const DefBlueAreaHint = "GameModeHint/DefBlueArea";
const DefThisAreaHint = "GameModeHint/DefThisArea";
const WaitingForBlueBuildHint = "GameModeHint/WaitingForBlueBuild";
const ChangeTeamHint = "GameModeHint/ChangeTeam";
const YourAreaIsCapturing = "GameModeHint/YourAreaIsCapturing";
const PrepareToDefBlueArea = "GameModeHint/PrepareToDefBlueArea";

// получаем постоянные объекты с режимах, с которыми работает захват
const mainTimer = Timers.GetContext().Get("Main");
const defTickTimer = Timers.getContext().Get("DefTimer");
const stateProp = Properties.GetContext().Get("State");
const defAreas = AreaService.GetByTag(DefAreaTag);
const captureAreas = AreaService.GetByTag(CaptureAreaTag);
let captureTriggers = [];
let captureViews = [];
let captureProperties = [];
const capturedAreaIndexProp = Properties.GetContext().Get("RedCaptiredIndex");

// пробустим цвет зонам
Map.OnLoad.Add(function () {
 InitializeDefAreas();
});

function InitializeDefAreas() {
 defAreas = AreaService.GetByTag(DefAreaTag);
 captureAreas = AreaService.GetByTag(CaptureAreaTag);
// ограничитель зон захвата
 if (captureAreas == null) return;
 if (captureAreas.length == 0) return;
captureTriggers = [];
captureViews = [];
captureProperties = [];

// сортировка всех зон по названиям
 captureAreas.sort(function (a, b) {
if (a.Name > b.Name) return 1;
if (a.Name < b.Name) return -1;
      return 0;
});

// инициализация переменных констант, с режимом зон захвата 
 for (const i = 0; i < captureAreas.length; ++i) {
// создаем визуализатор зоны
const view = AreaViewService.GetContext().Get(captureAreas[i].Name + "View");
captureViews.push(view);
// создаем триггер зоны для захвата
const trigger = AreaPlayerTriggerService.Get(captureAreas[i].Name + "Trigger");
captureTriggers.push(trigger);
   // создаем свойство для захвата зон, и до объектов 
       const prop = Properties.GetContext().Get(captureAreas[i].Name + "Property");
	 prop.OnValue.Add(CapturePropOnValue);
	    captureProperties.push(prop);
	}
}
InitializeDefAreas();
//function LogTrigger(player, trigger) {
//	log.debug("вошли в " + trigger);
//}
function CapturePropOnValue(prop) {
  // индекс зоны захвата
const index = -1;
   for (const i = 0; i < captureProperties.length; ++i)
	if (captureProperties[i] == prop) {
		index = i;
	break;
		}
    // отмачаем зону захваченой/незахваченой при ее захвате или не удачей захватить
if (prop.Value >= CapturePoints) CaptureArea(index);
	  else {
 // фейк-закраска зоны
  const d = prop.Value / MaxCapturePoints;
if (index >= 0) {
	captureViews[index].Color = {
			r: (FakeCapturedColor.r - UnCapturedColor.r) * d + UnCapturedColor.r,
			g: (FakeCapturedColor.g - UnCapturedColor.g) * d + UnCapturedColor.g,
			b: (FakeCapturedColor.b - UnCapturedColor.b) * d + UnCapturedColor.b
			};
		}
// снятие захвата с зон
UnCaptureArea(index);
	}
    // задаем предназначенный индекс захваченой зоны 
	 SetSpawnIndex();
}

// отмечаем данную зону захваченной 
function CaptureArea(index) {
	if (index < 0 || index >= captureAreas.length) return;
	captureViews[index].Color = CapturedColor;
	if (index < captureProperties.length - 1)
		captureViews[index + 1].Enable = true;
}
// отмечаем зону не захваченой красными
function UnCaptureArea(index) {
	if (index < 0 || index >= captureAreas.length) return;
	captureViews[index].Color = UnCapturedColor;
	if (index < captureProperties.length - 1 && captureProperties[index + 1].Value < CapturePoints)
		captureViews[index + 1].Enable = false;
	if (index > 0 && captureProperties[index - 1].Value < CapturePoints)
		captureViews[index].Enable = false;
}
// индекс захвата спавна
function SetSpawnIndex() {
 // макс областей захвата
	  const maxIndex = -1;
  for (const i = 0; i < captureProperties.length; ++i) {
	 if (captureProperties[i].Value >= CapturePoints)
		maxIndex = i;
	}
	capturedAreaIndexProp.Value = maxIndex;
}
// смена индекса захвата
capturedAreaIndexProp.OnValue.Add(function (prop) {
 const index = prop.Value;
	const spawns = Spawns.GetContext(redTeam);
 // очистка спавнов от захвата
   spawns.CustomSpawnPoints.Clear();
	   // если захват занулен то спавн забрасываем
	if (index < 0 || index >= captureAreas.length) return;
  // задаем очищенные спавны до захвата
const area = captureAreas[index];
 area.Ranges.All.forEach(iter => {
     const range = iter;
       // определяем просмотр спавнов
 const lookPoint = {};
    if (index < captureAreas.length - 1) lookPoint = captureAreas[index + 1].Ranges.GetAveragePosition();
	  else {
	if (defAreas.length > 0)
		lookPoint = defAreas[0].Ranges.GetAveragePosition();
	}

	 // задаем диапазоны захвата кастомных спавнов
	//log.debug("range=" + range);
	const spawnsCount = 0;
	for (const x = range.Start.x; x < range.End.x; x += 2)
		for (const z = range.Start.z; z < range.End.z; z += 2) {
			spawns.CustomSpawnPoints.Add(x, range.Start.y, z, Spawns.GetSpawnRotation(x, z, lookPoint.x, lookPoint.z));
			++spawnsCount;
			if (spawnsCount > MaxSpawnsByArea) return;
		}
});

// проверка валидности режима с поинтов
//if (defAreas.length == 0) Validate.ReportInvalid("GameMode/Validation/NeedDefTaggedArea");
//else Validate.ReportValid();

// применяем свойства параметров, для получения кастомных функции
Damage.FriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// визулязатор зоны защиты
var defView = AreaViewService.GetContext().Get("DefView");
defView.Color = UnCapturedColor;
defView.Tags = [DefAreaTag];
defView.Enable = true;

// триггер зоны защиты
const defTrigger = AreaPlayerTriggerService.Get("DefTrigger");
defTrigger.Tags = [DefAreaTag];
defTrigger.Enable = true;
defTrigger.OnEnter.Add(function (p) {
 if (p.Team == blueTeam) {
p.Ui.Hint.Value = DefThisAreaHint;
   return;
}
  if (p.Team == redTeam) {
if (stateProp.Value == GameStateValue)
   p.Ui.Hint.Value = HoldPositionHint;
else
   p.Ui.Hint.Reset();
return;
	}
});
defTrigger.OnExit.Add(function (p) {
	p.Ui.Hint.Reset();
});

// задаем обработчик таймера триггера
defTickTimer.OnTimer.Add(function (t) {
	DefTriggerUpdate();
	CaptureTriggersUpdate();
});
function DefTriggerUpdate() {
	// ограничитель игрового режима
	if (stateProp.Value != GameStateValue) return;
	// поиск количества синих и красных в триггере
	var blueCount = 0;
	var redCount = 0;
	var players = defTrigger.GetPlayers();
	for (var i = 0; i < Players.length; ++i) {
		var p = Players[i];
		if (p.Team == blueTeam) ++blueCount;
		if (p.Team == redTeam) ++redCount;
	}

	// если красных нет в зоне то восстанавливаются очки
	if (redCount == 0) {
		// восстанавливаем очки до несгораемой суммы
		if (blueTeam.Properties.Get("Deaths").Value % SavePointsCount != 0)
			blueTeam.Properties.Get("Deaths").Value += RepairPointsBySecond;
		// синим идет подска об обороне зоны
		if (stateProp.Value == GameStateValue)
			blueTeam.Ui.Hint.Value = DefBlueAreaHint;
		return;
	}

	// если есть хоть один красный то очки отнимаются
	blueTeam.Properties.Get("Deaths").Value -= redCount;
	// синим идет подсказка что зону захватывают
	if (stateProp.Value == GameStateValue)
		blueTeam.Ui.Hint.Value = YourAreaIsCapturing;
}
// обновление зон захвата
function CaptureTriggersUpdate() {
	// ограничитель игрового режима
	if (stateProp.Value != GameStateValue) return;
	// ограничитель
	if (captureTriggers == null) return;
	if (captureTriggers.length == 0) return;
	// обновление
	for (const i = 0; i < captureTriggers.length; ++i) {
		// берем триггер
		const trigger = captureTriggers[i];
		// поиск количества синих и красных в триггере
		const blueCount = 0;
	        const redCount = 0;
		Players = trigger.GetPlayers();
		for (const j = 0; j < Players.length; ++j) {
			var p = Players[j];
			if (p.Team == blueTeam) ++blueCount;
			if (p.Team == redTeam) ++redCount;
		}
		// берем свойство захвата
		const index = -1;
		for (const i = 0; i < captureTriggers.length; ++i)
			if (captureTriggers[i] == trigger) {
				index = i;
				break;
			}
		if (index < 0) continue;
		const value = captureProperties[index].Value;
		// определяем на сколько очков изменять зону
		// очки за присутствие синих
		const changePoints = - blueCount * BlueCaptureW;
		// очки за присутствие красных
		if (index == 0 || captureProperties[index - 1].Value >= CapturePoints)
			changePoints += redCount * RedCaptureW;
		// спад очков захвата, если нет красных
		if (redCount == 0 && value < CapturePoints) changePoints -= CaptureRestoreW;
		// ограничители
		if (changePoints == 0) continue;
		const newValue = value + changePoints;
		if (newValue > MaxCapturePoints) newValue = MaxCapturePoints;
		if (newValue < 0) newValue = 0;
		// изменяем очки захвата зоны
		captureProperties[index].Value = newValue;
	}
}

// бустим блок игрока
BreackGraph.PlayerBlockBoost = true;

// параметры режима игры (устарело)
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// создаем стандартные команды
var blueTeam = teams.create_team_blue();
var redTeam = teams.create_team_red();
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// делаем моментальный спавн синим
blueTeam.Spawns.RespawnTime.Value = 0;
redTeam.Spawns.RespawnTime.Value = 10;

// макс очкой синей команды
blueTeam.Properties.Get("Deaths").Value = DefPoints;
// лидерборд команд
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "Statistics/Kills",
		ShortDisplayName: "Statistics/KillsShort"
	},
	{
		Value: "Deaths",
		DisplayName: "Statistics/Deaths",
		ShortDisplayName: "Statistics/DeathsShort"
	},
	{
		Value: "Spawns",
		DisplayName: "Statistics/Spawns",
		ShortDisplayName: "Statistics/SpawnsShort"
	},
	{
		Value: "Scores",
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	}
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: "Deaths",
	DisplayName: "Statistics\Deaths",
	ShortDisplayName: "Statistics\Deaths"
};
// вес игрока в убийств команд 
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get("Kills").Value;
});

// задаем в табе на верху экране 
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };

// разрешаем вход в команды
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
// спавн по входу 
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn() });

// бессмертие после респавна
var immortalityTimerName = "immortality";
Spawns.GetContext().OnSpawn.Add(function (player) {
	player.Properties.Immortality.Value = true;
	player.Timers.Get(immortalityTimerName).Restart(5);
});
Timers.OnPlayerTimer.Add(function (timer) {
	if (timer.Id != immortalityTimerName) return;
	timer.Player.Properties.Immortality.Value = false;
});

// если в команде количество смертей занулилось то завершаем игру
Properties.OnTeamProperty.Add(function (context, value) {
	if (context.Team != blueTeam) return;
	if (value.Name !== "Deaths") return;
	if (value.Value <= 0) RedWin();
});

// обработчие спавнов
Spawns.OnSpawn.Add(function (player) {
	++player.Properties.Spawns.Value;
});
// обработчик смертей
Damage.OnDeath.Add(function (player) {
	++player.Properties.Deaths.Value;
});
// обработчик убийств
Damage.OnKill.Add(function (player, killed) {
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

// настройка переключения режимов
mainTimer.OnTimer.Add(function () {
	switch (stateProp.Value) {
		case WaitingStateValue:
			SetBuildMode();
			break;
		case BuildModeStateValue:
			SetGameMode();
			break;
		case GameStateValue:
			BlueWin();
			break;
		case EndOfMatchStateValue:
			RestartGame();
			break;
	}
});

// задаем первое игровое состояние
SetWaitingMode();

// состояния игры
function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Ожидание, всех - игроков...";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}

function SetBuildMode() {
	// инициализация режима
	for (const i = 0; i < captureAreas.length; ++i) {
		// визуализатор зон защиты
		const view = captureViews[i];
		view.Area = captureAreas[i];
		view.Color = UnCapturedColor;
		view.Enable = i == 0;
		// триггер зон защиты
		const trigger = captureTriggers[i];
		trigger.Area = captureAreas[i];
		trigger.Enable = true;
		//trigger.OnEnter.Add(LogTrigger);
		// свойсто 
		const prop = captureProperties[i];
		prop.Value = 0;
	}

	stateProp.Value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = ChangeTeamHint;
	blueTeam.Ui.Hint.Value = "Застраивайте, синию - зону и отбивайтесь от красных!";
	redTeam.Ui.Hint.Value = "Синие, готовятся - к атаке, помешай им застроить синию зону!";

	blueTeam.Inventory.Main.Value = false;
	blueTeam.Inventory.Secondary.Value = false;
	blueTeam.Inventory.Melee.Value = true;
	blueTeam.Inventory.Explosive.Value = false;
	blueTeam.Inventory.Build.Value = true;
	blueTeam.Inventory.BuildInfinity.Value = true;

	redTeam.Inventory.Main.Value = false;
	redTeam.Inventory.Secondary.Value = false;
	redTeam.Inventory.Melee.Value = false;
	redTeam.Inventory.Explosive.Value = false;
	redTeam.Inventory.Build.Value = false;

	mainTimer.Restart(BuildBaseTime);
	Spawns.GetContext().enable = true;
	SpawnTeams();
}
function SetGameMode() {
	stateProp.Value = GameStateValue;
	blueTeam.Ui.Hint.Value = "Защищайте, синию - зону!";
	redTeam.Ui.Hint.Value = "Захватите, синию - зону!";

	blueTeam.Inventory.Main.Value = true;
	blueTeam.Inventory.MainInfinity.Value = true;
	blueTeam.Inventory.Secondary.Value = true;
	blueTeam.Inventory.SecondaryInfinity.Value = true;
	blueTeam.Inventory.Melee.Value = true;
	blueTeam.Inventory.Explosive.Value = true;
	blueTeam.Inventory.Build.Value = true;

	redTeam.Inventory.Main.Value = true;
	redTeam.Inventory.Secondary.Value = true;
	redTeam.Inventory.Melee.Value = true;
	redTeam.Inventory.Explosive.Value = true;
	redTeam.Inventory.Build.Value = true;

	mainTimer.Restart(GameModeTime);
	defTickTimer.RestartLoop(DefTimerTickInderval);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
function BlueWin() {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Конец, матча - победила команда: синия!";
	blueTeam.Properties.Scores.Value += WINNERS_SCORES;

	const spawns_context = Spawns.GetContext();
	spawns_context.enable = false;
	spawns_context.Despawn();
	Game.GameOver(blueTeam);
	mainTimer.Restart(EndOfMatchTime);
}
function RedWin() {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Конец, матча - победила команда: красная!";
	redTeam.Properties.Scores.Value += WINNERS_SCORES;

	const spawns_context = Spawns.GetContext();
	spawns_context.enable = false;
	spawns_context.Despawn();
	Game.GameOver(redTeam);
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	for (const team of Teams)
		Spawns.GetContext(team).Spawn();
}
