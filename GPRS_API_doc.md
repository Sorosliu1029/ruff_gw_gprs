## 基础

```javascript
$('#gprs').powerOn(); // 启动GPRS模块
$('#gprs').powerOff(); // 关闭GPRS模块

// 模块启动后进入ready事件
$('#gprs').on('ready', function () {
});

// 模块关闭后进入end事件
$('#gprs').on('end', function () {
});
```

## GPRS网络

```javascript
$('#gprs').init(apn); // 进入GPRS网络 APN: Access Point Name, e.g. "CMNET"
$('#gprs').deInit(); // 退出GPRS网络

// 连接网络后进入up事件(CIPMUX+CSTT+CIICR+CIFSR)
$('#gprs').on('up', function (localIP) { // localIP: IP of GPRS module
});

// 退出网络后进入down事件(CIPSHUT)
$('#gprs').on('down', function () {
});

// 连接网络发生错误进入error事件
$('#gprs').on('error', function () {
});
```

## TCP

- TCP connection

```javascript
// 获取IP地址（需要在'up'事件中调用）(CIFSR)
$('#gprs').getIP(function (error, ip) {
});

// 获取所有的可用连接状态(CIPSTATUS)
$('#gprs').getConnections(function (error, connections) {
	// conn.id 连接ID
	// conn.ip 连接IP
	// conn.port 连接端口号
	// conn.status 连接状态
});
```

- TCP client （支持多个连接）

> 参考NodeJS TCP

```javascript
var host = '10.185.255.100';
var port = 8888;

// CIPSTART
var client = $('#gprs').createConnection(host, port);

// 连接成功进入connect事件
client.on('connect', function () {
    // 测试如果写入的数据没有及时发送出去的情况[TODO]
    // CIPSEND (length)
	client.write('I\'m client!'); // 向连接写入数据
});

// 接收数据后进入data事件
// 测试接收data过程中ring或SMS上报的情况[TODO]
client.on('data', function (buffer) {
	console.log('REVC: ' + buffer.toString());
	client1.destroy(); // 关闭连接
});

// 关闭连接后进入close事件
client.on('close', function () {
});

// server发送EOF进入end事件[TODO]
client.on('end', function () {
});

// client发送完成进入drain事件[TODO]
client.on('drain', function () {
});

// 当错误发生进入error事件（比如连接失败等）
client.on('error', function (error) {
});
```

## MISC

```javascript
// 获取信号强度
$('#gprs').getSignalStrength(function (error, strength) {
	// strength (dB)
});

// 获取GPRS网络状态（CGATT）
$('#gprs').getNetStatus(function (error, status) {
	// status = false|true
});

// 获取基站信息（CREG=2）
$('#gprs').getCellInfo(function (error, lac, cid) {
	// LAC, Location Area Code
	// CID, Cell tower ID
});

// 获取SIM卡信息
$('#gprs').getSimInfo(function (error, iccid, imsi) {
	// ICCID, Integrated Circuit Card Identity
	// IMSI, International Mobile Subscriber Indentification Number
});

// 写入RAW AT指令（比如'AT+CREG?'）
$('#gprs').writeRaw(command, function (error, data) {
});
```
