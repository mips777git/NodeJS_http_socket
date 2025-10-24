/**
 * Room 클래스 모듈
 * WebSocket 클라이언트들을 관리하고 메시지를 브로드캐스트하는 방(Room) 기능을 제공합니다
 */

// Socket.io 라이브러리에서 Socket 클래스를 불러옵니다 (타입 힌트용)
const { Socket } = require("socket.io");
// Winston 로거를 불러옵니다 (소켓 관련 이벤트 로깅용)
const {SocketLogger} = require("../logs/winston");
// crypto 모듈로 고유 ID 생성
const crypto = require("crypto");

/**
 * Room 클래스
 * WebSocket 클라이언트들을 관리하고 메시지를 브로드캐스트하는 방(Room) 클래스
 *
 * @class Room
 * @description
 * - 연결된 모든 WebSocket 클라이언트를 Map으로 관리
 * - 클라이언트 ID를 키로 사용하여 추가 정보 저장 가능
 * - 클라이언트 추가/제거 기능 제공
 * - 모든 클라이언트에게 메시지를 브로드캐스트하는 기능 제공
 */
class Room {
    /**
     * Room 생성자
     * 클라이언트 관리를 위한 Map 객체를 초기화합니다
     *
     * @constructor
     * @description
     * - Map을 사용하여 클라이언트 ID를 키로, 클라이언트 정보를 값으로 저장합니다
     * - Map은 순서를 보장하며 (삽입 순서), 빠른 추가/삭제/검색이 가능합니다 O(1)
     * - 각 클라이언트는 { ws: WebSocket, id: string, joinedAt: Date } 형태로 저장됩니다
     */
    constructor() {
        /**
         * 연결된 WebSocket 클라이언트들을 저장하는 Map
         * @type {Map<string, {ws: WebSocket, id: string, joinedAt: Date}>}
         * 키: 클라이언트 고유 ID (string)
         * 값: { ws: WebSocket 객체, id: 클라이언트 ID, joinedAt: 접속 시간 }
         */
        this.clients = new Map();

        SocketLogger.info("새로운 Room 인스턴스가 생성되었습니다 (Map 기반)");
    }

    /**
     * 클라이언트를 방에 추가합니다
     *
     * @param {WebSocket} client - 방에 추가할 WebSocket 클라이언트 객체
     * @param {string} [clientId] - 클라이언트 고유 ID (선택 사항, 없으면 자동 생성)
     * @returns {string} 할당된 클라이언트 ID
     * @description
     * - Map.set()을 사용하여 클라이언트를 추가합니다
     * - 클라이언트 ID가 제공되지 않으면 랜덤 ID를 자동 생성합니다
     * - 같은 ID로 다시 추가하면 기존 클라이언트를 덮어씁니다
     */
    join(client, clientId = null){
        // 클라이언트 ID가 없으면 자동 생성 (랜덤 16자리 hex)
        const id = clientId || crypto.randomBytes(8).toString('hex');

        // 클라이언트 정보 객체 생성
        const clientInfo = {
            ws: client,           // WebSocket 객체
            id: id,               // 클라이언트 고유 ID
            joinedAt: new Date()  // 접속 시간
        };

        // Map에 클라이언트 추가 (키: ID, 값: 클라이언트 정보)
        this.clients.set(id, clientInfo);

        // 새 클라이언트 접속 로그 기록
        SocketLogger.info(`새 클라이언트 접속 [ID: ${id}] (총 ${this.clients.size}명)`);

        // WebSocket 객체에 ID 저장 (나중에 leave할 때 사용)
        client.clientId = id;

        return id;
    }

    /**
     * 클라이언트를 방에서 제거합니다
     *
     * @param {WebSocket|string} clientOrId - 제거할 WebSocket 클라이언트 객체 또는 클라이언트 ID
     * @returns {boolean} 제거 성공 여부 (true: 제거됨, false: 존재하지 않음)
     * @description
     * - Map.delete()를 사용하여 클라이언트를 제거합니다
     * - WebSocket 객체 또는 ID 문자열 둘 다 받을 수 있습니다
     * - 존재하지 않는 클라이언트 제거 시도는 무시됩니다
     */
    leave(clientOrId){
        let clientId;

        // clientOrId가 문자열이면 ID로 간주, 아니면 WebSocket 객체에서 ID 추출
        if (typeof clientOrId === 'string') {
            clientId = clientOrId;
        } else {
            // WebSocket 객체에서 ID 가져오기
            clientId = clientOrId.clientId;
        }

        // ID가 없으면 제거 불가
        if (!clientId) {
            SocketLogger.warn("클라이언트 ID를 찾을 수 없어 제거할 수 없습니다");
            return false;
        }

        // 클라이언트 제거 시도
        const removed = this.clients.delete(clientId);

        if (removed) {
            // 제거 성공 시 로그 기록
            SocketLogger.info(`클라이언트 퇴장 [ID: ${clientId}] (남은 클라이언트: ${this.clients.size}명)`);
        } else {
            // 제거 실패 시 (이미 없는 클라이언트) 경고 로그
            SocketLogger.warn(`제거하려는 클라이언트 [ID: ${clientId}]가 방에 존재하지 않습니다`);
        }

        return removed;
    }

    /**
     * 연결된 모든 클라이언트에게 메시지를 전송합니다 (브로드캐스트)
     *
     * @param {Object} message - 전송할 메시지 객체 (JSON으로 직렬화됨)
     * @returns {void}
     * @description
     * - 방에 있는 모든 클라이언트를 순회하며 메시지를 전송합니다
     * - 메시지는 JSON.stringify()를 통해 문자열로 변환됩니다
     * - 전송 실패한 클라이언트는 에러 로그에 기록됩니다
     */
    forwardMessage(message){
        // 메시지 브로드캐스트 시작 로그
        SocketLogger.info(`메시지 브로드캐스트 시작 (대상: ${this.clients.size}명)`);

        // 전송 성공/실패 카운터
        let successCount = 0;
        let failCount = 0;

        // Map의 모든 값(value)을 순회 - 각 값은 { ws, id, joinedAt } 객체
        for(const [clientId, clientInfo] of this.clients){
            try {
                const client = clientInfo.ws; // WebSocket 객체 추출

                // WebSocket의 readyState 확인 (1 = OPEN)
                if (client.readyState === 1) {
                    // 메시지 객체를 JSON 문자열로 변환하여 전송
                    client.send(JSON.stringify(message));
                    successCount++;
                } else {
                    // 연결이 열려있지 않은 클라이언트
                    SocketLogger.warn(`[ID: ${clientId}] 연결이 닫힌 클라이언트에게 메시지 전송 실패`);
                    failCount++;
                }
            } catch (error) {
                // 전송 중 에러 발생 시 로그 기록
                SocketLogger.error(`[ID: ${clientId}] 메시지 전송 실패: ${error.message}`);
                failCount++;
            }
        }

        // 브로드캐스트 완료 로그
        SocketLogger.info(`메시지 브로드캐스트 완료 (성공: ${successCount}, 실패: ${failCount})`);
    }

    /**
     * 특정 클라이언트에게만 메시지를 전송합니다 (유니캐스트)
     *
     * @param {string} clientId - 메시지를 받을 클라이언트 ID
     * @param {Object} message - 전송할 메시지 객체
     * @returns {boolean} 전송 성공 여부
     */
    sendToClient(clientId, message) {
        const clientInfo = this.clients.get(clientId);

        if (!clientInfo) {
            SocketLogger.warn(`[ID: ${clientId}] 클라이언트를 찾을 수 없습니다`);
            return false;
        }

        try {
            const client = clientInfo.ws;

            if (client.readyState === 1) {
                client.send(JSON.stringify(message));
                SocketLogger.info(`[ID: ${clientId}] 메시지 전송 성공`);
                return true;
            } else {
                SocketLogger.warn(`[ID: ${clientId}] 클라이언트 연결이 닫혀있습니다`);
                return false;
            }
        } catch (error) {
            SocketLogger.error(`[ID: ${clientId}] 메시지 전송 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * 클라이언트 정보를 조회합니다
     *
     * @param {string} clientId - 조회할 클라이언트 ID
     * @returns {Object|null} 클라이언트 정보 또는 null
     */
    getClient(clientId) {
        return this.clients.get(clientId) || null;
    }

    /**
     * 모든 클라이언트 ID 목록을 반환합니다
     *
     * @returns {Array<string>} 클라이언트 ID 배열
     */
    getClientIds() {
        return Array.from(this.clients.keys());
    }

    /**
     * 현재 방에 연결된 클라이언트 수를 반환합니다
     *
     * @returns {number} 연결된 클라이언트 수
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * 방의 모든 클라이언트를 제거합니다
     *
     * @returns {void}
     * @description
     * - 서버 종료 시 또는 방을 초기화할 때 사용합니다
     */
    clear() {
        const previousCount = this.clients.size;
        this.clients.clear();
        SocketLogger.info(`방 초기화: ${previousCount}명의 클라이언트 제거됨`);
    }
}

// Room 클래스를 다른 모듈에서 사용할 수 있도록 내보냅니다
module.exports = Room;
