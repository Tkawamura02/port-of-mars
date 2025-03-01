import { Game, GameEvent, Player } from "@port-of-mars/server/entity";
import { BaseService } from "@port-of-mars/server/services/db";
import { GameStatus } from "@port-of-mars/shared/types";
import { IsNull } from "typeorm";

export class GameService extends BaseService {
  async findById(id: number): Promise<Game> {
    return await this.em.getRepository(Game).findOneOrFail(id);
  }

  async findByRoomId(roomId: string): Promise<Game> {
    return await this.em.getRepository(Game).findOneOrFail({
      where: { roomId },
    });
  }

  async getTotalActiveGames(): Promise<number> {
    return await this.em.getRepository(Game).count({
      dateFinalized: IsNull(),
    });
  }

  async getTotalCompletedGames(
    status: GameStatus | Array<GameStatus> = [{ status: "victory" }, { status: "defeat" }]
  ): Promise<number> {
    return await this.em.getRepository(Game).count({
      where: status,
    });
  }

  async getCompletedGames(
    interval: { start: string; end: string },
    bots: boolean,
    defeats: boolean
  ): Promise<Array<Game>> {
    let query = this.em
      .getRepository(Game)
      .createQueryBuilder("game")
      .leftJoinAndSelect("game.players", "player")
      .leftJoinAndSelect("player.user", "user")
      .where("game.dateFinalized BETWEEN :start AND :end", interval);
    if (defeats) {
      query = query.andWhere("game.status IN (:...status)", { status: ["victory", "defeat"] });
    } else {
      query = query.andWhere("game.status = :status", { status: "victory" });
    }
    if (bots) {
      return query.getMany();
    } else {
      return (
        await query.andWhere("user.isSystemBot = :isSystemBot", { isSystemBot: false }).getMany()
      ).filter((game: Game) => game.players.length > 1);
    }
  }

  async getTotalGamesWithBots(
    status: GameStatus | Array<GameStatus> = [{ status: "victory" }, { status: "defeat" }]
  ): Promise<number> {
    return this.em
      .getRepository(Game)
      .createQueryBuilder("game")
      .innerJoin("game.players", "player")
      .innerJoin("player.user", "user")
      .where("user.isSystemBot = :isSystemBot", { isSystemBot: true })
      .andWhere("game.status = :status", status)
      .getCount();
  }

  async findEventsByGameId(gameId: number): Promise<Array<GameEvent>> {
    return await this.em.getRepository(GameEvent).find({ where: { gameId }, order: { id: "ASC" } });
  }

  async getActiveGameRoomId(userId: number): Promise<string | undefined> {
    const game = await this.em
      .getRepository(Game)
      .createQueryBuilder("game")
      .innerJoin("game.players", "player")
      .innerJoin("player.user", "user")
      .where("game.status = 'incomplete'")
      .andWhere("user.id = :userId", { userId })
      .orderBy("game.dateCreated", "DESC")
      .getOne();

    return game?.roomId;
  }

  async getNumberOfActiveParticipants(tournamentRoundId?: number): Promise<number> {
    if (!tournamentRoundId) {
      tournamentRoundId = (await this.sp.tournament.getCurrentTournamentRound()).id;
    }
    return await this.em
      .getRepository(Player)
      .createQueryBuilder("player")
      .innerJoin("player.game", "game")
      .where("game.status = 'incomplete'")
      .andWhere("game.tournamentRoundId = :tournamentRoundId", {
        tournamentRoundId,
      })
      .getCount();
  }

  async isUserInActiveGame(id: number) {
    return (
      (await this.em
        .getRepository(Game)
        .createQueryBuilder("game")
        .innerJoin("game.players", "player")
        .where("status = 'incomplete'")
        .andWhere("player.userId = :id", { id })
        .getCount()) > 0
    );
  }
}
