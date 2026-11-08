import draw from './draw.js';
import ego from './ego.js';
import match from './match.js';
import trivia from './trivia.js';

/*
 * Every game in the pack. To add one, create a module that default-exports:
 *
 *   { id, title, tagline, minPlayers, create(room) }
 *
 * create(room) returns an object with:
 *   start()                  begin the game (the room has already switched to it)
 *   input(playerId, data)    a 'game:input' message from a phone
 *   view(playerId)           what that player's phone should show (sent as state.game)
 *   screenView()             what the host screen should show (everyone's public info)
 *   playerLeft()             optional: a player disconnected
 *   destroy()                stop timers
 *
 * Call room.sync() after any change, and room.finish(scores) with a
 * Map of playerId -> score when the game is over. The room turns scores into
 * the final standings. Then add matching UI modules: the phone controller in public/js/games/
 * and the host screen in public/js/screens/.
 */
export const GAMES = Object.fromEntries([trivia, match, ego, draw].map((g) => [g.id, g]));

export const GAME_LIST = Object.values(GAMES).map(({ id, title, tagline, minPlayers }) => ({ id, title, tagline, minPlayers }));
