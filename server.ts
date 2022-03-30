import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
var cron = require("node-cron");
import yenv from "yenv";

interface IPlayer {
  id: string;
  ws: WebSocket;
}

class Room {
  public id: string;
  public players: Set<IPlayer> = new Set<IPlayer>();

  constructor(id: string, ...args: IPlayer[]) {
    this.id = id;
    for (let i = 0; i < args.length; i++) {
      this.players.add(args[i]);
    }
  }
}

let port: number = +process.env.PORT;
if (process.env.MEDIO !== "HEROKU") {
  const env = yenv();
  port = env.PORT;
}

const wss: WebSocketServer = new WebSocketServer({ port }, () =>
  console.log("Server started...")
);

const waiting: Set<IPlayer> = new Set<IPlayer>();
const rooms: Map<string, Room> = new Map<string, Room>();

wss.on("connection", (ws: WebSocket) => {
  const id: string = uuidv4();
  waiting.add({ id: id, ws: ws });

  console.log("Client connected: " + id);
  ws.send("id:" + id);

  if (waiting.size >= 2) {
    const players: Array<IPlayer> = [];
    waiting.forEach((j) => {
      players.push(j);
    });

    const roomID = players[0].id + players[1].id;
    rooms.set(roomID, new Room(roomID, players[0], players[1]));

    console.log("Room created: " + roomID);
    console.log(rooms.get(roomID));
    players[0].ws.send("room:" + roomID);
    players[1].ws.send("room:" + roomID);

    waiting.delete(players[0]);
    waiting.delete(players[1]);
  }

  ws.on("message", (data) => {
    const msg = data.toString();

    if (msg.startsWith("all:")) {
      const data = msg.replace("all:", "");

      console.log(data);

      wss.clients.forEach(function each(client: WebSocket) {
        if (client != ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }

    if (msg.startsWith("room:")) {
      const data = msg.split(":");
      if (data.length == 3) {
        if (rooms.has(data[1])) {
          const room: Room = rooms.get(data[1]);
          if (room) {
            room.players.forEach((p: IPlayer) => {
              if (p.ws != ws && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send("points:" + data[2]);
              }
            });
          }
        }
      }
    }
  });
});

wss.on("listening", () => {
  console.log("...listening on: " + port);
});

cron.schedule("*/25 * * * *", () => {
  console.log("LIVE");
});
