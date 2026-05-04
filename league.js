const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const state = {
  standings: [],
  matches: [],
  sortKey: "rank",
  sortDirection: "asc",
};

const sortTypes = {
  rank: "number",
  player: "text",
  played: "number",
  wins: "number",
  draws: "number",
  losses: "number",
  goalsFor: "number",
  goalsAgainst: "number",
  goalDifference: "number",
  points: "number",
  pointsPerGame: "number",
  winRate: "number",
  captain: "number",
};

function uniqueNames(players) {
  return [...new Set(players.map((player) => player.trim()).filter(Boolean))];
}

function ensurePlayer(map, player) {
  if (!map.has(player)) {
    map.set(player, {
      player,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      pointsPerGame: 0,
      winRate: 0,
      captain: 0,
      pickedFirst: 0,
      rank: 0,
    });
  }
  return map.get(player);
}

function addResult(map, players, goalsFor, goalsAgainst, outcome, points, captain, pickedFirst) {
  uniqueNames(players).forEach((player) => {
    const row = ensurePlayer(map, player);
    row.played += 1;
    row.goalsFor += goalsFor;
    row.goalsAgainst += goalsAgainst;
    row.points += points;
    row[outcome] += 1;
    if (player === captain) {
      row.captain += 1;
      row.pickedFirst += pickedFirst ? 1 : 0;
    }
  });
}

function buildStandings(matches) {
  const players = new Map();

  matches.forEach((match) => {
    let team1Outcome = "draws";
    let team2Outcome = "draws";
    let team1Points = 1;
    let team2Points = 1;

    if (match.team1Score > match.team2Score) {
      team1Outcome = "wins";
      team2Outcome = "losses";
      team1Points = 3;
      team2Points = 0;
    } else if (match.team2Score > match.team1Score) {
      team1Outcome = "losses";
      team2Outcome = "wins";
      team1Points = 0;
      team2Points = 3;
    }

    addResult(players, match.team1Players, match.team1Score, match.team2Score, team1Outcome, team1Points, match.captain1, match.captain1PickedFirst);
    addResult(players, match.team2Players, match.team2Score, match.team1Score, team2Outcome, team2Points, match.captain2, match.captain2PickedFirst);
  });

  const standings = [...players.values()].map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    pointsPerGame: row.played ? row.points / row.played : 0,
    winRate: row.played ? (row.wins / row.played) * 100 : 0,
  }));

  standings.sort(leagueSort);
  standings.forEach((row, index) => {
    row.rank = index + 1;
  });

  return standings;
}

function leagueSort(a, b) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    b.wins - a.wins ||
    a.player.localeCompare(b.player)
  );
}

function sortedRows(rows) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const type = sortTypes[state.sortKey];

  return [...rows].sort((a, b) => {
    if (type === "text") {
      return direction * a[state.sortKey].localeCompare(b[state.sortKey]);
    }
    return direction * (a[state.sortKey] - b[state.sortKey]);
  });
}

function visibleRows() {
  const query = document.getElementById("player-search").value.trim().toLowerCase();
  const minAppearances = Number(document.getElementById("appearance-filter").value);

  return state.standings.filter((row) => {
    return row.player.toLowerCase().includes(query) && row.played >= minAppearances;
  });
}

function signedNumber(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function goalDifferenceClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function renderTable() {
  const tbody = document.querySelector("#league-table tbody");
  const rows = sortedRows(visibleRows());

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td><span class="rank-badge">${row.rank}</span></td>
      <td><span class="player-name">${row.player}</span></td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td class="${goalDifferenceClass(row.goalDifference)}">${signedNumber(row.goalDifference)}</td>
      <td><strong>${row.points}</strong></td>
      <td>${numberFormatter.format(row.pointsPerGame)}</td>
      <td>${percentFormatter.format(row.winRate)}</td>
      <td>${row.captain}</td>
    </tr>
  `).join("");
}

function renderSummary() {
  const latest = state.matches.at(-1);
  document.getElementById("summary-matches").textContent = state.matches.length;
  document.getElementById("summary-players").textContent = state.standings.length;
  document.getElementById("summary-latest").textContent = latest ? dateFormatter.format(new Date(`${latest.date}T00:00:00`)) : "-";
}

function playerList(players) {
  return uniqueNames(players).join(", ");
}

function renderMatches() {
  const list = document.getElementById("match-list");
  list.innerHTML = [...state.matches].reverse().slice(0, 6).map((match) => {
    const team1Won = match.team1Score > match.team2Score;
    const team2Won = match.team2Score > match.team1Score;

    return `
      <article class="match-row">
        <time class="match-date" datetime="${match.date}">${dateFormatter.format(new Date(`${match.date}T00:00:00`))}</time>
        <div class="match-team ${team1Won ? "winner" : ""}">
          <strong>${match.team1}</strong>
          <span>${playerList(match.team1Players)}</span>
        </div>
        <div class="match-score" aria-label="${match.team1Score} to ${match.team2Score}">
          <span>${match.team1Score}</span><span>-</span><span>${match.team2Score}</span>
        </div>
        <div class="match-team ${team2Won ? "winner" : ""}">
          <strong>${match.team2}</strong>
          <span>${playerList(match.team2Players)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function attachEvents() {
  document.getElementById("player-search").addEventListener("input", renderTable);
  document.getElementById("appearance-filter").addEventListener("change", renderTable);

  document.querySelectorAll("#league-table th[data-sort]").forEach((heading) => {
    heading.addEventListener("click", () => {
      const nextKey = heading.dataset.sort;
      if (state.sortKey === nextKey) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = nextKey;
        state.sortDirection = sortTypes[nextKey] === "text" ? "asc" : "desc";
      }
      renderTable();
    });
  });
}

async function init() {
  const response = await fetch("results.json");
  const data = await response.json();
  state.matches = data.matches;
  state.standings = buildStandings(data.matches);

  renderSummary();
  renderTable();
  renderMatches();
  attachEvents();
}

init();
