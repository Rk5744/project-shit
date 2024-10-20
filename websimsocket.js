class WebsimSocket {
    constructor() {
      this.url = 'wss://92388739-6ca1-469d-b773-cab71d1ac81b-00-1lx7zzrf3va8p.kirk.repl.co:3000';
      this.ws = new WebSocket(this.url);
      this.store = this.createStore();
      this.party = {
        client: {
          username: `user_${Math.random().toString(36).substr(2, 9)}`
        }
      };
      this.peers = {};
      this.messageCallbacks = new Set();
      this.peerCallbacks = new Set();
      this.recordCallbacks = new Set();
      this.storeCallbacks = new Map();
      this.heartbeatInterval = 30000;
      this.heartbeatTimer = null;

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'stateUpdate':
            this.handleStateUpdate(data);
            break;
          case 'peersUpdate':
            this.handlePeersUpdate(data.peers);
            break;
          case 'storeResponse':
            const callback = this.storeCallbacks.get(data.requestId);
            if (callback) {
              callback(data.state);
              this.storeCallbacks.delete(data.requestId);
            }
            break;
          case 'message':
            this.messageCallbacks.forEach(cb => cb(data));
            break;
          case 'heartbeat':
            break;
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.stopHeartbeat();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.stopHeartbeat();
      };
    }

    createStore() {
      const websocket = this;
      return {
        async get(id) {
          return new Promise((resolve) => {
            const requestId = Math.random().toString(36).substr(2, 9);
            websocket.storeCallbacks.set(requestId, resolve);

            websocket.ws.send(JSON.stringify({
              type: 'storeGet',
              id,
              requestId
            }));
          });
        },

        async update({ id, dependencies, updateFunction }) {
          const currentState = await this.get(id);
          const newState = updateFunction(currentState);

          websocket.ws.send(JSON.stringify({
            type: 'storeUpdate',
            id,
            state: newState,
            dependencies
          }));
        }
      };
    }

    send(data) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'message',
          data,
          sender: this.party.client.username
        }));
      }
    }

    handleStateUpdate(data) {
      this.recordCallbacks.forEach(cb => cb(data.id));
    }

    handlePeersUpdate(peers) {
      this.peers = peers;
      this.peerCallbacks.forEach(cb => cb(peers));
    }

    set onmessage(callback) {
      this.messageCallbacks.clear();
      this.messageCallbacks.add(callback);
    }

    set onPeersChanged(callback) {
      this.peerCallbacks.clear();
      this.peerCallbacks.add(callback);
    }

    set onRecordChanged(callback) {
      this.recordCallbacks.clear();
      this.recordCallbacks.add(callback);
    }

    startHeartbeat() {
      this.heartbeatTimer = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, this.heartbeatInterval);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }
}

window.WebsimSocket = WebsimSocket;
