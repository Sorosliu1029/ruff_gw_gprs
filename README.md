# GPRS Driver for SIM800C

This driver is used to create multiple TCP clients.

## Device Model

- [sim800c](https://rap.ruff.io/devices/sim800c)

## Install

```sh
> rap device add --model sim800c --id <device-id> 
```

## Demo

Supposed \<device-id\> is `gprs` in the following demos.

```js
gprs = $('#gprs');
gprs.on('ready', function () {
    gprs.init('CMNET');
    gprs.on('down', function () {
        console.log('net is down');
    });

    gprs.on('error', function (error) {
        console.log('gprs error: ' + error);
    });

    gprs.on('up', function (localIP) {
        console.log('net is up, IP: ' + localIP);

        gprs.getConnections(function (error, connections) {
            connections.forEach(function (conn) {
                console.log('connection ' + conn.id + ' : ' + conn.ip +
                    ':' + conn.port + ' status: ' + conn.status);
            });
        });

        gprs.getSignalStrength(function (error, strength) {
            console.log('signal strength: ', strength);
        });

        gprs.getNetStatus(function (error, status) {
            console.log('net status: ', status);
        });

        gprs.getCellInfo(function (error, lac, cid) {
            console.log('cell info lac: ' + lac + ' cid: ' + cid);
        });

        gprs.getSimInfo(function (error, iccid, imsi) {
            console.log('sim info: iccid: ' + iccid + ' imsi: ' + imsi);
        });

        var host = '107.170.252.91';
        var port = 8888;
        var client = gprs.createConnection(host, port);
        client.on('connect', function () {
            console.log('client connect ok');
            client.write('Client send');
        });

        client.on('data', function (buffer) {
            console.log('receive data: ' + buffer);
        });

        client.on('drain', function () {
            console.log('client sending data drain');
        });

        client.on('close', function () {
            console.log('client closed');
        });

        client.on('error', function (error) {
            console.log('client error: ' + error);
        });
    });
});

gprs.on('end', function () {
    console.log('gprs is powered off');
});

gprs.powerOn();

});
```

## API References

### Methods

#### `powerOn()`

Power on the SIM800C GPRS hardware module.

#### `powerOff()`

Power off the SIM800C GPRS hardware module.

#### `init(apn)`

Bring up GPRS network.

`apn`, a.k.a Access Point Name, should be 'CMNET', 'UNINET'.

#### `deInit()`

Bring down GPRS network.

#### `getIP(callback)`

Get the IP address of the GPRS module.

Should be used in 'up' event.

The parameters for `callback`  is   `error`, ` ip` .

#### `getConnections(callback)`

Get all connection status.

The parameters for `callback`  is `error` , `connections`.

And `connections`  is an array of `connection` objects.

`connection` object has the following properties:

- id: connection ID
- ip: connection IP
- port: connection port
- status: connection status

#### `createConnection(host, port)`

Create a TCP connection to `host` : `port`.

It will return a `Client` instance. See [Class Client](#client) for more reference.

#### `getSignalStrength(callback)`

Get GPRS module signal strength.

The parameters for `callback` is `error` , `strength` .

#### `getNetStatus(callback)`

Get GPRS network attach status.

The parameters for `callback` is `error` , `status` .

If GPRS network is attached, `status` will be `true`. Otherwise, GPRS network is detached, `status` will be `false`.

#### `getCellInfo(callback)`

Get the base station information.

The parameters for `callback` is `error` , `lac` , `cid`. 

`lac` , a.k.a Location Area Code. 

`cid` , a.k.a Cell Tower ID.

#### `getSimInfo(callback)`

Get the SIM card information.

The parameters for `callback`  is `error` , `iccid` , `imsi`.

`iccid` , a.k.a Integrated Circuit Card Identity.

`imsi` , a.k.a International Mobile Subscriber Identification Number

#### `writeRaw(command, callback)`

Write raw AT command to the SIM800C module.

The parameters for `callback`  is `error` , `data`.

`data`  is an array containing the command response. 

### Events

#### 'ready'

`function () {}`

Emitted when GPRS module is powered on successfully.

#### 'end'

`function () {}`

Emitted when GPRS module is powered off successfully.

#### 'up'

`function (localIP) {}`

Emitted when GPRS network is brought up successfully.

`localIP`  is the IP of the GPRS module.

#### 'down'

`function () {}`

Emitted when GPRS network is brought down successfully.

#### 'error'

`function (error) {}`

Emitted whenever GPRS module has an error occurring.

### <a id="client"></a>Class: Client

### Methods

#### `write(data)`

Write data to the connection and send it.

It should be used in 'connect' event.

NOTE: `data` should be less than 1460 bytes length.

`data` could be String or Buffer.

#### `destory()`

Close the connection.

### Events

#### 'connect'

`function () {}`

Emitted after `createConnection` method is called and connection is connected successfully.

#### 'data'

`function (buffer) {}`

Emitted when receive data from the other end of connection.

#### 'close'

`function () {}`

Emitted when connection is closed successfully.

#### 'drain'

`function () {}`

Emitted when `write` method has sent all `data` successfully.

#### 'error'

`function () {}`

Emitted whenever error that related to connection occurs.

## Supported OS

Test passed on Ruff Lite v0.6.0  (Ruff Gateway 1294 board).

## Note

For inner developer, the os built should statisfy the following condition:

1. UART3 buffer size should be at least 1.5k bytes ( 1.5 * 1024 = 1536 bytes)
2. If need to use SD card to write down connection received data, should modify memory allocation between jerry and os.