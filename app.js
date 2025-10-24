/**
 * NodeSocket 서버 메인 파일
 * Express와 WebSocket을 결합한 실시간 통신 서버
 */

// ============================================================
// 모듈 임포트
// ============================================================

// 필요한 모듈들을 불러옵니다
const express = require('express'); // Express 웹 프레임워크
const http = require('http'); // HTTP 서버 생성을 위한 모듈
const cors = require('cors'); // CORS(Cross-Origin Resource Sharing) 미들웨어
const WebSocket = require('ws'); // WebSocket 라이브러리
const { Socket } = require('socket.io'); // Socket.io 타입 (현재 미사용)
const { SocketLogger } = require('./logs/winston'); // Winston 로거
const Room = require('./types/Room'); // Room 클래스 (클라이언트 관리용)

// ============================================================
// Express 서버 설정
// ============================================================

// Express 애플리케이션 인스턴스 생성
const app = express();

// CORS 미들웨어 설정 - 모든 도메인에서의 요청을 허용
app.use(
  cors({
    origin: '*', // 모든 출처(origin)에서의 요청을 허용 (프로덕션에서는 특정 도메인만 허용 권장)
  })
);

// JSON 형식의 요청 본문을 파싱하는 미들웨어
app.use(express.json());

// URL 인코딩된 요청 본문을 파싱하는 미들웨어 (extended: false - querystring 라이브러리 사용)
app.use(express.urlencoded({ extended: false }));

// ============================================================
// HTTP 및 WebSocket 서버 생성
// ============================================================

// HTTP 서버 생성 (Express app을 기반으로)
const server = http.createServer(app);

// WebSocket 서버 생성 (HTTP 서버에 연결)
const wss = new WebSocket.Server({ server });

// Room 인스턴스 생성 (연결된 모든 클라이언트 관리용)
const room = new Room();

// ============================================================
// WebSocket 이벤트 핸들러
// ============================================================

/**
 * WebSocket 서버의 'connection' 이벤트 핸들러
 * 새로운 클라이언트가 연결되면 실행됩니다
 */
wss.on('connection', (ws, req) => {
  SocketLogger.info('새로운 WebSocket 클라이언트가 연결되었습니다');

  const cookies = req.headers.cookie;
  console.log('Cookies:', cookies);
  const { _, user } = cookies.split('=');

  // 클라이언트를 방에 추가
  room.join(ws);

  /**
   * 클라이언트로부터 메시지를 받았을 때 실행되는 핸들러
   * @param {Buffer|String} message - 클라이언트로부터 받은 메시지
   */
  ws.on('message', (message) => {
    try {
      // 받은 메시지를 문자열로 변환
      const messageStr = message.toString();
      SocketLogger.info(`메시지 수신: ${messageStr}`);

      // JSON 파싱 시도
      const parsedMessage = JSON.parse(messageStr);

      // 모든 클라이언트에게 메시지 브로드캐스트
      room.forwardMessage(parsedMessage);
    } catch (error) {
      // JSON 파싱 실패 시 에러 로그
      SocketLogger.error(`메시지 처리 중 오류 발생: ${error.message}`);
    }
  });

  /**
   * 클라이언트 연결이 종료되었을 때 실행되는 핸들러
   */
  ws.on('close', () => {
    SocketLogger.info('WebSocket 클라이언트 연결이 종료되었습니다');

    // 방에서 클라이언트 제거
    room.leave(ws);
  });

  /**
   * WebSocket 통신 중 에러 발생 시 실행되는 핸들러
   * @param {Error} error - 발생한 에러 객체
   */
  ws.on('error', (error) => {
    SocketLogger.error(`WebSocket 에러 발생: ${error.message}`);
  });

  // 연결 완료 메시지를 클라이언트에 전송
  ws.send(
    JSON.stringify({
      type: 'connected',
      message: '서버에 성공적으로 연결되었습니다',
      timestamp: new Date().toISOString(),
    })
  );
});

// ============================================================
// Express 라우트 정의
// ============================================================

/**
 * 루트 경로 ('/') GET 요청 핸들러
 * 서버 상태 확인용 엔드포인트
 */
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'NodeSocket 서버가 정상적으로 실행 중입니다',
    websocket: 'ws://localhost:' + PORT,
    timestamp: new Date().toISOString(),
  });
});

/**
 * 서버 상태 확인용 헬스체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// 서버 시작
// ============================================================

// 포트 설정 (환경 변수 또는 기본값 8080 사용)
const PORT = process.env.PORT || 8080;

// HTTP 서버 시작 (WebSocket 서버도 함께 시작됨)
server.listen(PORT, () => {
  SocketLogger.info(`========================================`);
  SocketLogger.info(`NodeSocket 서버가 시작되었습니다`);
  SocketLogger.info(`HTTP: http://localhost:${PORT}`);
  SocketLogger.info(`WebSocket: ws://localhost:${PORT}`);
  SocketLogger.info(`========================================`);
});
