import {
  Game,
  Player,
  User,
  TournamentRound,
  TournamentRoundInvite,
} from "@/database/entities";
import { IsNull, Not, SelectQueryBuilder } from "typeorm";
import _ from "lodash";

export class DashboardService {
  /**
   * generate a parameterized survey URL with pid=participantId and tid=tournamentRoundInvite.id
   * @param round
   * @param invite
   */
  getIntroSurveyUrl(
    user: User,
    round: TournamentRound,
    invite: TournamentRoundInvite | undefined
  ): string {
    return this.buildSurveyUrl(round.introSurveyUrl, user, invite);
  }

  getExitSurveyUrl(
    user: User,
    round: TournamentRound,
    invite: TournamentRoundInvite | undefined
  ): string {
    return this.buildSurveyUrl(round.exitSurveyUrl, user, invite);
  }

  buildSurveyUrl(
    surveyUrl: string | undefined,
    user: User,
    invite: TournamentRoundInvite | undefined
  ): string {
    if (invite && surveyUrl) {
      surveyUrl = `${surveyUrl}?pid=${user.participantId}&tid=${
        invite.id
      }&redirectHost=${encodeURIComponent(useRuntimeConfig().host)}`;
    }
    return surveyUrl ?? "";
  }
}
