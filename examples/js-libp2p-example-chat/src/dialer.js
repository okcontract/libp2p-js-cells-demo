/* eslint-disable no-console */
import { writeFileSync } from "fs";
import { Debugger, Sheet, SheetProxy } from "@okcontract/cells";

import { createFromJSON } from "@libp2p/peer-id-factory";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "./libp2p.js";
import peerIdDialerJson from "./peer-id-dialer.js";
import peerIdListenerJson from "./peer-id-listener.js";
import { stdinToStream, streamToConsole } from "./stream.js";

const sheet = new Sheet();
const debug = new Debugger(sheet);
const proxy = new SheetProxy(sheet);

async function run() {
  const idDialer = proxy.new(createFromJSON(peerIdDialerJson), "idDialer");
  const idListener = proxy.new(
    createFromJSON(peerIdListenerJson),
    "idListener",
  );
  const nodeDialer = idDialer.map(
    (dial) =>
      createLibp2p({
        peerId: dial,
        addresses: {
          listen: ["/ip4/0.0.0.0/tcp/0"],
        },
      }),
    "nodeDialer",
  );
  const listeners = nodeDialer.map(
    (dial) => dial.getMultiaddrs().map((addr) => addr.toString()),
    "listeners",
  );
  listeners.subscribe((l) => console.log(`Dialer ready, listening on: ${l})`));

  // Dial to the remote peer (the "listener")
  const listenerMa = idListener.map(
    (lis) => multiaddr(`/ip4/127.0.0.1/tcp/10333/p2p/${lis.toString()}`),
    "listenerMa",
  );
  const stream = proxy.map(
    [nodeDialer, listenerMa],
    (dial, lis) => dial.dialProtocol(lis, "/chat/1.0.0"),
    "stream",
  );

  stream.subscribe((stream) => {
    // console.log({ stream });
    console.log("Dialer dialed to listener on protocol: /chat/1.0.0");
    console.log("Type a message and see what happens");

    // Send stdin to the stream
    stdinToStream(stream);
    // Read the stream and output to console
    streamToConsole(stream);
  });

  writeFileSync("dialer.dot", debug.dot("dialer"));
}

run();
