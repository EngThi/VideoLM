const startTimestamp = Date.now();
const pid = process.pid;

function log(context, message, color = '\x1b[32m') { // Green default
    const date = new Date().toLocaleString();
    console.log(`\x1b[32m[Nest]\x1b[0m ${pid}  - ${date}     \x1b[32mLOG\x1b[0m \x1b[33m[${context}]\x1b[0m ${color}${message}\x1b[0m`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.clear();
    console.log('\x1b[32m[Nest]\x1b[0m ' + pid + '  - ' + new Date().toLocaleString() + '     \x1b[32mLOG\x1b[0m \x1b[33m[NestFactory]\x1b[0m \x1b[32mStarting Nest application...\x1b[0m');
    await sleep(30);
    log('InstanceLoader', 'TypeOrmModule dependencies initialized');
    await sleep(10);
    log('InstanceLoader', 'AiModule dependencies initialized');
    await sleep(10);
    log('InstanceLoader', 'ProjectsModule dependencies initialized');
    await sleep(10);
    log('InstanceLoader', 'VideoModule dependencies initialized');
    await sleep(20);
    log('RoutesResolver', 'ProjectsController {/projects}:');
    log('RouterExplorer', 'Mapped {/projects, POST} route');
    log('RouterExplorer', 'Mapped {/projects, GET} route');
    log('RouterExplorer', 'Mapped {/projects/:id, GET} route');
    await sleep(30);
    log('NestApplication', 'Nest application successfully started');
    console.log(`\x1b[33m[Nest]\x1b[0m ${pid}  - ${new Date().toLocaleString()}     \x1b[32mLOG\x1b[0m \x1b[33m[VideoGateway]\x1b[0m \x1b[36mWebSocket Gateway initialized on port 3001\x1b[0m`);
    
    await sleep(150);
    console.log(`\x1b[33m[Nest]\x1b[0m ${pid}  - ${new Date().toLocaleString()}     \x1b[32mLOG\x1b[0m \x1b[33m[VideoGateway]\x1b[0m \x1b[36mClient connected: socket_id_8f7a2\x1b[0m`);
    
    await sleep(200);
    log('ProjectsController', 'CreateProjectDto: { topic: "The History of Coffee", style: "Documentary" }');
    log('AiService', 'Generating script with Gemini Pro...');
    await sleep(150);
    log('AiService', 'Script generated. Scenes: 5. Estimated duration: 45s.');
    
    await sleep(80);
    log('VideoService', 'Starting asset generation pipeline for Project #42');
    console.log(`\x1b[33m[Nest]\x1b[0m ${pid}  - ${new Date().toLocaleString()}     \x1b[32mLOG\x1b[0m \x1b[33m[VideoGateway]\x1b[0m \x1b[35mEmitting progress: 10% (Generating Script)\x1b[0m`);

    await sleep(100);
    log('ImageService', 'Fetching image for scene 1: "Coffee beans close up"... (Source: Pollinations)');
    log('ImageService', 'Fetching image for scene 2: "Ethiopian goat herder"... (Source: Pollinations)');
    log('ImageService', 'Fetching image for scene 3: "Coffee house in 17th century London"... (Source: Pollinations)');
    await sleep(200);
    console.log(`\x1b[33m[Nest]\x1b[0m ${pid}  - ${new Date().toLocaleString()}     \x1b[32mLOG\x1b[0m \x1b[33m[VideoGateway]\x1b[0m \x1b[35mEmitting progress: 40% (Images Ready)\x1b[0m`);

    await sleep(100);
    log('FfmpegService', 'Starting FFmpeg rendering process...');
    console.log('\x1b[90m$ ffmpeg -y -loop 1 -t 5 -i img1.png -loop 1 -t 5 -i img2.png -filter_complex "[0:v]zoompan=z=\'min(zoom+0.0015,1.5)\':d=125...[v0]" -map "[v0]" out.mp4\x1b[0m');
    
    await sleep(50);
    
    // Simulate FFmpeg Output
    const totalFrames = 450;
    let currentFrame = 0;
    const startTime = Date.now();

    while (currentFrame < totalFrames) {
        currentFrame += Math.floor(Math.random() * 15) + 5;
        if (currentFrame > totalFrames) currentFrame = totalFrames;
        
        const fps = 24 + Math.random() * 5;
        const q = 28.0;
        const size = (currentFrame * 1.5).toFixed(0);
        const time = new Date((currentFrame / 25) * 1000).toISOString().substr(11, 8);
        const bitrate = 1200 + Math.random() * 200;
        const speed = (Math.random() * 0.5 + 0.8).toFixed(2);

        process.stdout.write(`\rframe=${currentFrame} fps=${fps.toFixed(1)} q=${q} size=    ${size}kB time=${time}.00 bitrate=${bitrate.toFixed(1)}kbits/s speed=${speed}x    `);
        await sleep(10);
    }
    
    console.log('\n');
    log('FfmpegService', 'Rendering complete. Output: /server/dist/public/projects/proj_42.mp4');
    console.log(`\x1b[33m[Nest]\x1b[0m ${pid}  - ${new Date().toLocaleString()}     \x1b[32mLOG\x1b[0m \x1b[33m[VideoGateway]\x1b[0m \x1b[35mEmitting progress: 100% (Complete)\x1b[0m`);
    log('ProjectsService', 'Project #42 saved to database.');
}

run();
