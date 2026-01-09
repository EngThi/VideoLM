"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalErrorFilter = void 0;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let GlobalErrorFilter = class GlobalErrorFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const message = exception instanceof Error ? exception.message : 'Unknown error';
        const stack = exception instanceof Error ? exception.stack : '';
        const logMessage = `[${new Date().toISOString()}] ${request.method} ${request.url} - Status: ${status} - Error: ${message}\nStack: ${stack}\n\n`;
        try {
            fs.appendFileSync(path.join(__dirname, '../../server.log'), logMessage);
        }
        catch (e) {
            console.error('Failed to write to log file', e);
        }
        console.error(logMessage);
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: message,
        });
    }
};
exports.GlobalErrorFilter = GlobalErrorFilter;
exports.GlobalErrorFilter = GlobalErrorFilter = __decorate([
    (0, common_1.Catch)()
], GlobalErrorFilter);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const { json, urlencoded } = require('express');
    app.use(json({ limit: '100mb' }));
    app.use(urlencoded({ extended: true, limit: '100mb' }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new GlobalErrorFilter());
    app.enableCors({
        origin: '*',
        credentials: true,
    });
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ Backend running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map