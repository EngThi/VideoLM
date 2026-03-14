"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: new common_1.Logger('Bootstrap'),
    });
    const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : 3001;
    await app.listen(port);
    app.get(common_1.Logger).log(`✅ Backend running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map