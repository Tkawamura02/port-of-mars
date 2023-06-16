import { createConnection } from "typeorm";
import http from "http";
import express, { Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import connectRedis from "connect-redis";
import * as Sentry from "@sentry/node";
import { Server } from "colyseus";
import schedule from "node-schedule";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as LocalStrategy } from "passport-local";

import { Constants, isDev, isDevOrStaging } from "@port-of-mars/shared/settings";

// server side imports
import { GameRoom } from "@port-of-mars/server/rooms/game";
import { SoloGameRoom } from "@port-of-mars/server/rooms/sologame";
import { User } from "@port-of-mars/server/entity";
import { LobbyRoom } from "@port-of-mars/server/rooms/lobby";
import { settings } from "@port-of-mars/server/settings";
import { getRedis, getServices } from "@port-of-mars/server/services";
import {
  adminRouter,
  authRouter,
  gameRouter,
  quizRouter,
  accountRouter,
  surveyRouter,
  statusRouter,
  statsRouter,
} from "@port-of-mars/server/routes";
import { ServerError } from "./util";

const logger = settings.logging.getLogger(__filename);
const NODE_ENV = process.env.NODE_ENV || "development";
const CONNECTION_NAME = NODE_ENV === "test" ? "test" : "default";

const RedisStore = connectRedis(session);
const store = new RedisStore({ host: "redis", client: getRedis() });
const sessionParser = session({
  resave: false,
  saveUninitialized: false,
  secret: settings.secret,
  store,
});

passport.use(
  new GoogleStrategy(
    {
      clientID: settings.googleAuth.clientId,
      clientSecret: settings.googleAuth.clientSecret,
      callbackURL: `${settings.serverHost}/auth/google/callback`,
      passReqToCallback: true,
    },
    async function (request: any, accessToken: any, refreshToken: any, profile: any, done: any) {
      const user = await getServices().account.getOrCreateUser({
        email: profile.emails[0].value,
        passportId: profile.id,
      });
      return done(null, user);
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: settings.facebookAuth.clientId,
      clientSecret: settings.facebookAuth.clientSecret,
      callbackURL: `${settings.serverHost}/auth/facebook/callback`,
      profileFields: ["id", "email"],
      passReqToCallback: true,
    },
    async function (request: any, accessToken: any, refreshToken: any, profile: any, done: any) {
      if (!profile.emails && !profile.emails[0]) {
        return done(null, false, {
          message: "You must use a Facebook account with a verified email address.",
        });
      }
      const user = await getServices().account.getOrCreateUser({
        email: profile.emails[0].value,
        passportId: profile.id,
      });
      return done(null, user);
    }
  )
);

if (isDevOrStaging()) {
  passport.use(
    new LocalStrategy(
      {
        passReqToCallback: true,
      },
      async function (req: any, username: string, password: string, done: any) {
        const shouldSkipVerification = req.query.shouldSkipVerification === "true";
        const user = await getServices().account.getOrCreateTestUser(
          username,
          shouldSkipVerification
        );
        await done(null, user);
      }
    )
  );
}

passport.serializeUser(function (user: Pick<User, "id">, done: any) {
  done(null, user.id);
} as any);

passport.deserializeUser(function (id: number, done: any) {
  getServices()
    .account.findUserById(id)
    .then(user => done(null, user))
    .catch(e => {
      logger.fatal(`Could not find user with ${id}: `, e);
      done(e, null);
    });
});

function applyInStagingOrProd(f: () => void) {
  if (["staging", "production"].includes(NODE_ENV)) {
    f();
  }
}

applyInStagingOrProd(() => {
  Sentry.init({ dsn: Constants.SENTRY_DSN });
  logger.debug("Setting up sentry: %s", Constants.SENTRY_DSN);
});

async function createApp() {
  await (async () => {
    const sp = getServices();
    await sp.settings.loadIfNotExist();
  })();

  logger.info(
    "starting (%s) server: [build id: %s, settings.host %s]",
    process.env.NODE_ENV,
    Constants.BUILD_ID,
    settings.host
  );
  const port = Number(process.env.PORT || 2567);
  const app = express();
  applyInStagingOrProd(() => app.use(Sentry.Handlers.requestHandler()));
  if (isDev()) {
    logger.info("starting server up in dev mode");
    app.use(
      cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
      })
    );
  } else {
    logger.info("setting helmet content security policy");
    app.use(
      helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "sentry.comses.net"],
          frameSrc: ["'self'", "player.vimeo.com", "youtube.com", "https://www.youtube.com"],
          scriptSrc: ["'self'", "sentry.comses.net"],
          imgSrc: ["'self'", "data:"],
          styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
          fontSrc: ["'self'", "fonts.gstatic.com"],
          objectSrc: ["'none'"],
        },
      })
    );
  }
  app.use(express.static("static"));
  app.use(express.json());
  app.use(cookieParser(settings.secret));
  app.use(sessionParser);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/admin", adminRouter);
  app.use("/auth", authRouter);
  app.use("/survey", surveyRouter);
  app.use("/stats", statsRouter);
  app.use("/game", gameRouter);
  app.use("/quiz", quizRouter);
  app.use("/account", accountRouter);
  app.use("/status", statusRouter);

  const server = http.createServer(app);
  const gameServer = new Server({
    server,
    // put express session into websocket onAuth requests
    verifyClient(info: any, next: any) {
      sessionParser(info.req as any, {} as any, () => next(true));
    },
  });

  // register your room handlers
  gameServer.define(GameRoom.NAME, GameRoom);
  gameServer.define(LobbyRoom.NAME, LobbyRoom);
  gameServer.define(SoloGameRoom.NAME, SoloGameRoom);

  applyInStagingOrProd(() => app.use(Sentry.Handlers.errorHandler()));
  // Final error handling middleware
  app.use((err: any, req: any, res: Response, next: any) => {
    if (err instanceof ServerError) {
      logger.warn(err);
      res.status(err.code).json(err.toDashboardMessage());
    } else {
      logger.fatal(err);
      res.status(err.statusCode || 500).json({ kind: "danger", message: err.message });
    }
  });

  gameServer.listen(port);

  const services = getServices();
  // run automated admin jobs (revoking expired mutes, etc) once a day
  await services.admin.unapplyExpiredMutes();
  schedule.scheduleJob("0 0 * * *", async () => {
    await services.admin.unapplyExpiredMutes();
  });
}

createConnection(CONNECTION_NAME)
  .then(async connection => {
    await createApp();
  })
  .catch(error => logger.fatal(error));
