// Winston 로깅 라이브러리에서 필요한 기능들을 불러옵니다
const { format, transports, createLogger } = require('winston');
// Winston의 일별 로그 파일 회전 기능을 제공하는 모듈
const winstonDaily = require('winston-daily-rotate-file');

// 로그 파일이 저장될 디렉토리 경로
const logDir = 'logs';

// 로그 출력 형식을 정의합니다 (타임스탬프 + 레벨 + 메시지)
const logFormat = format.printf((info) => {
  return `${info.timestamp} ${info.level} : ${info.message}`;
});

// Socket 전용 로거를 생성합니다
const SocketLogger = createLogger({
  // 로그 포맷 설정
  format: format.combine(
    // 타임스탬프를 "년-월-일 시:분:초" 형식으로 추가
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    // 위에서 정의한 커스텀 로그 형식 적용
    logFormat
  ),
  // 로그 전송 대상(transport) 설정
  transports: [
    // info 레벨 로그를 일별 파일로 저장
    new winstonDaily({
      filename: 'socket-info.log', // 파일명 패턴
      datePattern: 'YYYY-MM-DD', // 날짜 패턴 (일별로 새 파일 생성)
      dirname: logDir + '/socket', // 저장 경로
      level: 'info', // info 레벨 이상의 로그만 기록
    }),
    // error 레벨 로그를 별도 파일로 저장
    new winstonDaily({
      filename: 'socket-err.log', // 에러 로그 파일명 패턴
      datePattern: 'YYYY-MM-DD', // 날짜 패턴
      dirname: logDir + '/socket', // 저장 경로
      level: 'error', // error 레벨의 로그만 기록
    }),
  ],
});

// 콘솔 출력 전송 대상을 추가합니다 (개발 시 실시간 로그 확인용)
SocketLogger.add(
  new transports.Console({
    // 콘솔에서는 색상이 있는 간단한 형식으로 출력
    format: format.combine(format.colorize(), format.simple()),
  })
);

// SocketLogger를 다른 모듈에서 사용할 수 있도록 내보냅니다
module.exports = { SocketLogger };
