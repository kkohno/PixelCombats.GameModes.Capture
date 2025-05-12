import { Map, AreaService, AreaViewService, AreaPlayerTriggerService, Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote } from 'pixel_combats/room';
import { DisplayValueHeader, Color } from 'pixel_combats/basic';
import * as teams from './default_teams.js';

// настройки публичных объектов 
const WaitingPlayersTime = 11; // баг в секундах, при котором 1 секунда пропадает что получается не 10 а 9 в матче
const BuildBaseTime = 61;
const GameModeTime = 301;
const EndOfMatchTime = 11;
const VoteTime = 16;
const DefPoints = GameModeTime * 0.2;
const DefPointsMaxCount = 30;
const DefTimerTickInderval = 1;
const SavePointsCount = 10;
const RepairPointsBySecond = 0.5;
const CapturePoints = 10; // столько очков нужно, для захвата.
const MaxCapturePoints = 15; // макс очков захвата.
const RedCaptureW = 1; // вес красных, при захвате спавна
const BlueCaptureW = 2;	 // вес синих при захвате спавна
const CaptureRestoreW = 1; // сколько очков отнимается, если нет красных в зоне для захвата
const UnCapturedColor = new Color(1, 1, 1, 0);
const FakeCapturedColor = new Color(0, 0, 1, 0); // к какому цвету стремится зона при ее захвате
const CapturedColor = new Color(1, 0, 0, 0);
const MaxSpawnsByArea = 25; // макс спавнов на зону
const WaitingStateValue = "Waiting";
const BuildModeStateValue = "BuildMode";
const GameStateValue = "Game";
const EndOfMatchStateValue = "EndOfMatch";
const DefAreaTag = "def";
const CaptureAreaTag = "capture";
const HoldPositionHint = "Удерживайте, эту - позицию!"; // обновление подсказок 
const RunToBliePointHint = "Захватите, все - зоны!";
const DefBlueAreaHint = "Защищайте, синию - зону!";
const DefThisAreaHint = "Защищайте, эту - позицию!";
const WaitingForBlueBuildHint = "Синие застраивают, синию зону.Помешай им!";
const ChangeTeamHint = "Выберите, команду!";
const YourAreaIsCapturing = "Красные захватывают, синию - зону!";
const PrepareToDefBlueArea = "Застраивайте, синию - зону!";
const SCORES_PROP_NAME = 'Scores';
const IMMORTALITY_TIMER_NAME = 'Immortality';
const KILLS_PROP_NAME = 'Kills';
const winners_scores = 90;
const kill_scores = 50;
const timer_scores = 20;
const scores_timer_interval = 50;

// получаем объекты, с которыми работает - режим.
const mainTimer = Timers.GetContext().Get("Main");
const defTickTimer = Timers.getContext().Get("DefTimer");
const stateProp = Properties.GetContext().Get("State");
const defAreas = AreaService.GetByTag(DefAreaTag);
const captureAreas = AreaService.GetByTag(CaptureAreaTag);
let captureTriggers = [];
let captureViews = [];
let captureProperties = [];
const capturedAreaIndexProp = Properties.GetContext().Get("RedCaptiredIndex");

// задаем, определённые цвет - всем зонам.
Map.OnLoad.Add(function () {
 InitializeDefAreas();
});

function InitializeDefAreas() {
 defAreas = AreaService.GetByTag(DefAreaTag);
 captureAreas = AreaService.GetByTag(CaptureAreaTag);
// ограничитель зоны
 if (captureAreas == null) return;
 if (captureAreas.length == 0) return;
captureTriggers = [];
captureViews = [];
captureProperties = [];
    // сортировка зон, по имена - захвата
   captureAreas.sort(function (a, b) {
	if (a.Name > b.Name) return 1;
	if (a.Name < b.Name) return -1;
       return 0;
  });
// инициализация переменных зон, при получении объекты - зон
for (const i = 0; i < captureAreas.length; ++i) {
	// создаем публичный визулизатор, зоны - захвата
	const view = AreaViewService.GetContext().Get(captureAreas[i].Name + "View");
	  captureViews.push(view);
	// создаем триггер зоны, захвата.
	const trigger = AreaPlayerTriggerService.Get(captureAreas[i].Name + "Trigger");
	 captureTriggers.push(trigger);
	// создаем основное свойство, для захвата - зон
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
 // берем, постоянный индекс - зоны
const index = -1;
  for (const i = 0; i < captureProperties.length; ++i)
if (captureProperties[i] == prop) {
	index = i;
    break;
		}
// отметка для зоны, с захватов или без
 if (prop.Value >= CapturePoints) CaptureArea(index);
   else {
// красим, в фейк-закраску
 const d = prop.Value / MaxCapturePoints;
  if (index >= 0) {
	captureViews[index].Color = {
		r: (FakeCapturedColor.r - UnCapturedColor.r) * d + UnCapturedColor.r,
		g: (FakeCapturedColor.g - UnCapturedColor.g) * d + UnCapturedColor.g,
		b: (FakeCapturedColor.b - UnCapturedColor.b) * d + UnCapturedColor.b
		};
	}
// снятие захвата, с зон
	UnCaptureArea(index);
}
   // задаем индекс, захваченой зоны красными
	     SetSpawnIndex();
}
// отметка зоны, захвата
function CaptureArea(index) {
 if (index < 0 || index >= captureAreas.length) return;
     captureViews[index].Color = CapturedColor;
	      if (index < captureProperties.length - 1)
	    captureViews[index + 1].Enable = true;
}
// отметка зоны, не захваченной красными
function UnCaptureArea(index) {
  if (index < 0 || index >= captureAreas.length) return;
 captureViews[index].Color = FakeCapturedColor;
     if (index < captureProperties.length - 1 && captureProperties[index + 1].Value < CapturePoints)
   captureViews[index + 1].Enable = false;
	   if (index > 0 && captureProperties[index - 1].Value < CapturePoints)
		  captureViews[index].Enable = false;
}
// снимаем спавнпоинты после захвата
function SetSpawnIndex() {
  // индекс захваченной области
const maxIndex = -1;
  for (const i = 0; i < captureProperties.length; ++i) {
	if (captureProperties[i].Value >= CapturePoints)
 maxIndex = i;
	}
     capturedAreaIndexProp.Value = maxIndex;
}
// после смена индекса, захвата 
capturedAreaIndexProp.OnValue.Add(function (prop) {
 const index = prop.Value;
 const redSpawns = Spawns.GetContext(redTeam);
// отчистка красного спавнов
 redSpawns.CustomSpawnPoints.Clear();
  // если захват сброшен, то задаем новый
      if (index < 0 || index >= captureAreas.length) return;
          // задаем новые спавны
  	const area = captureAreas[index];
	const iter = area.Ranges.GetEnumerator();
	iter.MoveNext();
	const range = iter.Current;
	    // определение спавнов при просмотре камеры
	const lookPoint = {};
	   if (index < captureAreas.length - 1) lookPoint = captureAreas[index + 1].Ranges.GetAveragePosition();
    	      else {
		if (defAreas.length > 0)
			lookPoint = defAreas[0].Ranges.GetAveragePosition();
	}
	//log.debug("range=" + range);
	const spawnsCount = 0;
	for (const x = range.Start.x; x < range.End.x; x += 2)
		for (const z = range.Start.z; z < range.End.z; z += 2) {
			   redSpawns.CustomSpawnPoints.Add(x, range.Start.y, z, Spawns.GetSpawnRotation(x, z, lookPoint.x, lookPoint.z));
		    ++spawnsCount;
			  if (spawnsCount > MaxSpawnsByArea) return;
		}
});
// проверка валидности режима
//if (defAreas.length == 0) Validate.ReportInvalid("GameMode/Validation/NeedDefTaggedArea");
//else Validate.ReportValid();

// применяем параметры конструктора режима
Damage.FriendlyFire = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// создаем, триггер зон - защиты
var defView = AreaViewService.GetContext().Get("DefView");
defView.Color = FakeCapturedColor;
defView.Tags = [DefAreaTag];
defView.Enable = true;

// применяем, триггер зоны защиты
var defTrigger = AreaPlayerTriggerService.Get("DefTrigger");
defTrigger.Tags = [DefAreaTag];
defTrigger.Enable = true;
defTrigger.OnEnter.Add(function (player) {
	if (player.Team === blueTeam) {
	   player.Ui.Hint.Value = DefThisAreaHint;
		return;
	}
	if (player.Team == redTeam) {
		if (stateProp.Value === GameStateValue)
			player.Ui.Hint.Value = HoldPositionHint;
		else
			player.Ui.Hint.Reset();
		return;
	}
});
defTrigger.OnExit.Add(function (player) {
	player.Ui.Hint.Reset();
});

// обработчик таймера триггера
defTickTimer.OnTimer.Add(function (timer) {
 DefTriggerUpdate();
 CaptureTriggersUpdate();
});
function DefTriggerUpdate() {
 // ограничитель, для основного режима
   if (stateProp.Value != GameStateValue) return;
       // задаем синих и красных в триггер зоне
	const blueCount = 0;
	const redCount = 0;
	   const players = defTrigger.GetPlayers();
	for (const i = 0; i < players.length; ++i) {
		   const p = players[i];
		      if (p.Team == blueTeam) ++blueCount;
		      if (p.Team == redTeam) ++redCount;
	     }
	// если красные в не синей зоне, то восстанавливаем определение очки вверху экрана и в триггере
	    if (redCount === 0) {
	       // Восстанавливаем очки, после красных в триггере - до несгораемой суммы
		if (blueTeam.Properties.Get("Deaths").Value % SavePointsCount != 0)
		   blueTeam.Properties.Get("Deaths").Value += RepairPointsBySecond;
		// синим дается подсказка, об защите зоне
		if (stateProp.Value === GameStateValue)
			blueTeam.Ui.Hint.Value = DefBlueAreaHint;
		return;
	}
	// если у синих есть красный, то снижаем очки с вверху и в тригере
	blueTeam.Properties.Get("Deaths").Value -= redCount;
	   // синим приходит подсказка, что зону захватывают
	if (stateProp.Value === GameStateValue)
		blueTeam.Ui.Hint.Value = YourAreaIsCapturing;
}
// обнова зон захвата 
function CaptureTriggersUpdate() {
   // основной ограничитель зон
if (stateProp.Value != GameStateValue) return;
  // ограничитель зоны, при захвате
	if (captureTriggers == null) return;
	if (captureTriggers.length == 0) return;
// обнова зон
  for (const i = 0; i < captureTriggers.length; ++i) {
    // задаем триггер зоны
	const trigger = captureTriggers[i];
	// дублируем количество синих и красных в зонах
		const blueCount = 0;
		const redCount = 0;
		  players = trigger.GetPlayers();
	    for (const j = 0; j < players.length; ++j) {
		  const p = players[j];
			  if (p.Team == blueTeam) ++blueCount;
			  if (p.Team == redTeam) ++redCount;
		  }
	// основное свойства захвата в триггере
	 const index = -1;
	for (const i = 0; i < captureTriggers.length; ++i)
		   if (captureTriggers[i] == trigger) {
			index = i;
				break;
		}
	 if (index < 0) continue;
	   consg value = captureProperties[index].Value;
	// за столько очков, меняется зона захвата
	    // остальные очки, за присутствие синих
		const changePoints = - blueCount * BlueCaptureW;
		   // очки за красных при захвате триггере
		if (index === 0 || captureProperties[index - 1].Value >= CapturePoints)
		    changePoints += redCount * RedCaptureW;
		   // обнуляем очки, если красные в не зоне захвата
		if (redCount === 0 && value < CapturePoints) changePoints -= CaptureRestoreW;
		   // ограничители зоны, при продолжительности захвата
		    if (changePoints == 0) continue;
		 const newValue = value + changePoints;
		      if (newValue > MaxCapturePoints) newValue = MaxCapturePoints;
		           if (newValue < 0) newValue = 0;
		    // обрабатываем очки в зонах захвата
		       captureProperties[index].Value = newValue;
	  }
  }

// блок игрока, всегда забистин
BreackGraph.PlayerBlockBoost = true;

// параметры игрового режима (устарело\обновило)
Properties.GetContext().GameModeName.Value = "Capture"; // задаем, имя режима для захвата 
TeamsBalancer.IsAutoBalance = true; // авто баланс, команд
Ui.GetContext().MainTimerId.Value = mainTimer.Id; // задаем айди таймера, в режиме
// обрабатываем команды, при запросе на спавн
var blueTeam = teams.create_team_blue();
var redTeam = teams.create_team_red();
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;
// меняем время спавна (обновилось)
blueTeam.Spawns.RespawnTime.Value = 0;
redTeam.Spawns.RespawnTime.Value = 10;
// макс очки в триггере и с верху в табе
blueTeam.Properties.Get("Deaths").Value = DefPoints;

// настраиваем параметры, которые нужно выводить в лидерборде
LeaderBoard.PlayerLeaderBoardValues = [
 new DisplayValueHeader(KILLS_PROP_NAME, "K", "K"),
 new DisplayValueHeader("Deaths", "D", "D"),
 new DisplayValueHeader(SCORES_PROP_NAME, "Очки", "Очки"),
 new DisplayValueHeader("Spawns", "S", "S")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader("Deaths", "D", "D");
// задаем определённую сортировку игроков, для лидирующих в списке
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get("Kills").Value;
});

// назначаем, с вверху на экране счет, синей зоны в тригере
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };

// разрешаем всем, вход по командам
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
// респавним, после входа в команду
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn() });

// задаем неуязвимость, после респавна
Spawns.GetContext().OnSpawn.Add(function (player) {
	player.Properties.Immortality.Value = true;
	 // обновляем счет бессмертия, после респавна (обновление)
	player.Timers.Get(IMMORTALITY_TIMER_NAME).Restart(10);
});
Timers.OnPlayerTimer.Add(function (timer) {
 if (timer.Id === IMMORTALITY_TIMER_NAME) timer.Player.Properties.Immortality.Value = false;
});

// если в тригере занулились счета, то красные победили
Properties.OnTeamProperty.Add(function (context, value) {
 if (context.Team != blueTeam) return;
    if (value.Name !== "Deaths") return;
	// обновление ивента, когда красные победили (обновление)
  if (value.Value <= 0) {
	  RedWin();
      }
});

// обрабатываем спавны игроков
Spawns.OnSpawn.Add(function (player) {
    ++player.Properties.Spawns.Value;
});
// засчитываем смерти игроков 
Damage.OnDeath.Add(function (player) {
    if (player.Team === null) return;
	++player.Properties.Deaths.Value;
});
// обрабатываем убийства команд (обновление)
Damage.OnKill.Add(function (player, killed) {
   if (player.Team === null && killed.Team === null) return;
  if (player.id !== killed.id) player.Properties.Kills.Value++;
	 // выдаём очки игрокам, после убийства игрока
		player.Properties.Scores.Value += kill_scores;
	    player.Properties.Scores.Value += 100; // дополнительный очки для награды
   }
});

// задаем обработчик таймера
scores_timer.OnTimer.Add(function() {
 for (const player of Players.All) {
  if (player.Team === null) continue;
player.Properties.Scores.Value += timer_scores;
         }
});

// настройка режимов при каждом переключении на следующий режим
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
		start_vote();
		break;
	}
});

// изначально задаем, игровое состояние 
SetWaitingMode();

// задаём состояние следующих игр:
function SetWaitingMode() {
 stateProp.Value = WaitingStateValue;
 Ui.GetContext().Hint.Value = "Ожидание, всех - игроков...";
 Spawns.GetContext().enable = false;
 mainTimer.Restart(WaitingPlayersTime);
}
function SetBuildMode() {
 // инициализация зон режима 
 for (const i = 0; i < captureAreas.length; ++i) {
   // задаём тот же, визулиз зоны
const view = captureViews[i];
 view.Area = captureAreas[i];
 view.Color = UnCapturedColor;
 view.Enable = i === 0;
// триггер зоны после визулиза
 const trigger = captureTriggers[i];
   trigger.Area = captureAreas[i];
   trigger.Enable = true;
   //trigger.OnEnter.Add(LogTrigger);
// свойство триггера захвата
const prop = captureProperties[i];
    prop.Value = 0;
}
stateProp.Value = BuildModeStateValue;
Ui.GetContext().Hint.Value = ChangeTeamHint;
blueTeam.Ui.Hint.Value = PrepareToDefBlueArea;
redTeam.Ui.Hint.Value = WaitingForBlueBuildHint;

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
Spawns.GetContext().Enable = true;
SpawnTeams();
}
function SetGameMode() {
stateProp.Value = GameStateValue;
blueTeam.Ui.Hint.Value = DefBlueAreaHint;
redTeam.Ui.Hint.Value = RunToBliePointHint;

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
blueTeam.Properties.Scores.Value += winners_scores; // задаем очки синим (виде победы \обновление)
Ui.GetContext().Hint.Value = "Конец, матча - победила команда: синия!";

const spawns = Spawns.GetContext();
spawns.Enable = false;
spawns.Despawn();
Game.GameOver(blueTeam);
mainTimer.Restart(EndOfMatchTime);
}
function RedWin() {
stateProp.Value = EndOfMatchStateValue;
redTeam.Properties.Scores.Value += winners_scores; // задаем очки красным (виде победы \обновление)
Ui.GetContext().Hint.Value = "Конец, матча - победила команда: красная!";

const spawns = Spawns.GetContext();
spawns.Enable = false;
spawns.Despawn();
Game.GameOver(redTeam);
mainTimer.Restart(EndOfMatchTime);
}

function OnVoteResult(value) {
	if (value.Result === null) return;
	NewGame.RestartGame(value.Result);
}
NewGameVote.OnResult.Add(OnVoteResult); 

function start_vote() {
	NewGameVote.Start({
		Variants: [{ MapId: 0 }],
		Timer: VoteTime
	}, MapRotation ? 3 : 0);
}

function SpawnTeams() {
	for (const team of Teams)
		Spawns.GetContext(team).Spawn();
}

scores_timer.RestartLoop(scores_timer_interval);
