"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const stream_1 = require("stream");
const projects_service_1 = require("../projects/projects.service");
const video_gateway_1 = require("./video.gateway");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let VideoService = class VideoService {
    constructor(projectsService, videoGateway) {
        this.projectsService = projectsService;
        this.videoGateway = videoGateway;
        this.enginesPath = process.env.HOMES_ENGINE_PATH || '/path/to/HOMES-Engine';
    }
    generateSrt(script, totalDuration) {
        const rawLines = script.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [];
        const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
        const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
        let srtContent = '';
        let currentTime = 0;
        lines.forEach((line, i) => {
            const weight = line.length / totalChars;
            const duration = weight * totalDuration;
            const start = currentTime;
            const end = currentTime + duration;
            currentTime = end;
            const formatTime = (seconds) => {
                const date = new Date(0);
                date.setSeconds(seconds);
                const ms = Math.floor((seconds % 1) * 1000);
                return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
            };
            srtContent += `${i + 1}\n`;
            srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
            srtContent += `${line.trim()}\n\n`;
        });
        return srtContent;
    }
    getAudioDuration(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err)
                    return reject(err);
                const duration = metadata.format.duration;
                if (!duration)
                    return reject(new Error('Could not determine audio duration'));
                resolve(duration);
            });
        });
    }
    async createClip(imagePath, outputPath, duration, index, isLast = false) {
        const fps = 25;
        const targetDurationFrames = Math.ceil(duration * fps);
        const outputDuration = isLast ? duration + 5 : duration;
        const zoomCmd = index % 2 === 0
            ? `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=${fps}`
            : `zoompan=z='min(zoom+0.0015,1.5)':d=${targetDurationFrames}:x='if(eq(on,1),iw/2,x-1)':y='if(eq(on,1),ih/2,y)':s=1280x720:fps=${fps}`;
        const finalDurationFrames = Math.ceil(outputDuration * fps);
        const finalZoomCmd = zoomCmd.replace(`d=${targetDurationFrames}`, `d=${finalDurationFrames}`);
        const cmd = `ffmpeg -y -loop 1 -i "${imagePath}" -vf "scale=1920:-2,${finalZoomCmd},fade=t=in:st=0:d=0.5,fade=t=out:st=${outputDuration - 0.5}:d=0.5" -c:v libx264 -t ${outputDuration} -pix_fmt yuv420p -preset superfast "${outputPath}"`;
        await execAsync(cmd);
    }
    async assembleVideo(audioFile, imageFiles, inputDuration, script, bgMusicFile) {
        const tempDir = path.join(process.cwd(), 'temp', `assemble_${Date.now()}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        try {
            const audioPath = path.join(tempDir, 'audio.wav');
            fs.writeFileSync(audioPath, audioFile.buffer);
            const totalDuration = await this.getAudioDuration(audioPath);
            console.log(`Audio Duration detected: ${totalDuration}s (Input was: ${inputDuration}s)`);
            let srtPath;
            if (script) {
                srtPath = path.join(tempDir, 'subtitles.srt');
                const srtContent = this.generateSrt(script, totalDuration);
                fs.writeFileSync(srtPath, srtContent, 'utf-8');
            }
            let bgMusicPath;
            if (bgMusicFile) {
                bgMusicPath = path.join(tempDir, 'bg_music.mp3');
                fs.writeFileSync(bgMusicPath, bgMusicFile.buffer);
            }
            const clipPaths = [];
            const durationPerImage = totalDuration / imageFiles.length;
            console.log(`Rendering ${imageFiles.length} clips...`);
            this.videoGateway.broadcastProgress('dev-session', 5, 'rendering_clips');
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const imgPath = path.join(tempDir, `source_${i}.png`);
                const clipPath = path.join(tempDir, `clip_${i}.mp4`);
                const isLast = i === imageFiles.length - 1;
                fs.writeFileSync(imgPath, file.buffer);
                try {
                    await this.createClip(imgPath, clipPath, durationPerImage, i, isLast);
                    clipPaths.push(clipPath);
                    const percent = 5 + Math.round((i / imageFiles.length) * 40);
                    this.videoGateway.broadcastProgress('dev-session', percent, 'rendering_clips');
                }
                catch (e) {
                    console.error(`Failed to render clip ${i}:`, e);
                    throw e;
                }
            }
            const concatListPath = path.join(tempDir, 'concat_list.txt');
            const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
            fs.writeFileSync(concatListPath, concatListContent);
            const outStream = new stream_1.PassThrough();
            let command = ffmpeg();
            command = command
                .input(concatListPath)
                .inputOptions(['-f concat', '-safe 0']);
            command = command.input(audioPath);
            if (bgMusicPath) {
                command = command.input(bgMusicPath);
            }
            const filterComplex = [];
            let videoLabel = '0:v';
            if (srtPath) {
                const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
                filterComplex.push({
                    filter: 'subtitles',
                    options: {
                        filename: escapedSrtPath,
                        force_style: 'Alignment=2,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,Fontname=Arial,FontSize=24,PrimaryColour=&H0000FFFF,Bold=1'
                    },
                    inputs: '0:v',
                    outputs: 'vsubtitled'
                });
                videoLabel = '[vsubtitled]';
            }
            let audioLabel = '1:a';
            if (bgMusicPath) {
                filterComplex.push({
                    filter: 'volume',
                    options: '0.2',
                    inputs: '2:a',
                    outputs: 'bgmusic_low'
                });
                filterComplex.push({
                    filter: 'amix',
                    options: { inputs: 2, duration: 'first' },
                    inputs: ['1:a', 'bgmusic_low'],
                    outputs: 'amixed'
                });
                audioLabel = '[amixed]';
            }
            if (filterComplex.length > 0) {
                command.complexFilter(filterComplex);
            }
            const outputOptions = [
                '-c:v libx264',
                '-preset superfast',
                '-pix_fmt yuv420p',
                '-movflags frag_keyframe+empty_moov',
                '-shortest'
            ];
            if (filterComplex.length > 0) {
                outputOptions.push(`-map ${videoLabel}`);
                outputOptions.push(`-map ${audioLabel}`);
            }
            else {
                outputOptions.push('-map 0:v');
                outputOptions.push('-map 1:a');
            }
            command
                .outputOptions(outputOptions)
                .format('mp4')
                .on('start', (cmdLine) => {
                console.log('Spawned Final Assembly Ffmpeg: ' + cmdLine);
                this.videoGateway.broadcastProgress('dev-session', 50, 'assembling');
            })
                .on('progress', (progress) => {
                this.videoGateway.broadcastProgress('dev-session', 50 + Math.random() * 40, 'assembling');
            })
                .on('error', (err, stdout, stderr) => {
                console.error('❌ Final Assembly Error:', err.message);
                console.error('❌ Stderr:', stderr);
                this.videoGateway.broadcastProgress('dev-session', 0, 'error');
                if (!outStream.destroyed) {
                    outStream.emit('error', err);
                    outStream.end();
                }
            })
                .on('end', () => {
                console.log('✅ Video successfully assembled!');
                this.videoGateway.broadcastProgress('dev-session', 100, 'completed');
            })
                .pipe(outStream, { end: true });
            setTimeout(() => {
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
                catch (e) { }
            }, 600000);
            return outStream;
        }
        catch (error) {
            console.error('Video assembly setup error:', error);
            if (error instanceof Error) {
                console.error(error.stack);
                try {
                    const logPath = path.join(__dirname, '../../../server.log');
                    fs.appendFileSync(logPath, `[VideoAssembly Error] ${error.message}\n${error.stack}\n\n`);
                }
                catch (e) { }
            }
            throw error;
        }
    }
    async generateVideo(projectId, theme = 'yellow_punch') {
        try {
            const project = await this.projectsService.findOne(projectId);
            if (!project.script) {
                throw new common_1.BadRequestException('Project has no script');
            }
            await this.projectsService.updateStatus(projectId, 'processing');
            const scriptFile = path.join(this.enginesPath, 'scripts', `${projectId}.txt`);
            fs.writeFileSync(scriptFile, project.script, 'utf-8');
            const cmd = `cd ${this.enginesPath} && python main.py --script ${scriptFile} --theme ${theme}`;
            const { stdout, stderr } = await execAsync(cmd, { timeout: 600000 });
            const videoPath = stdout.trim();
            if (!fs.existsSync(videoPath)) {
                throw new Error(`Video file not found at ${videoPath}`);
            }
            await this.projectsService.updateStatus(projectId, 'done', videoPath);
            return {
                status: 'done',
                videoPath,
            };
        }
        catch (error) {
            const errorMsg = error.message || 'Unknown error';
            await this.projectsService.updateStatus(projectId, 'error', undefined, errorMsg);
            return {
                status: 'error',
                error: errorMsg,
            };
        }
    }
    async getStatus(projectId) {
        const project = await this.projectsService.findOne(projectId);
        return {
            status: project.status,
            videoPath: project.videoPath,
            error: project.error,
        };
    }
};
exports.VideoService = VideoService;
exports.VideoService = VideoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService,
        video_gateway_1.VideoGateway])
], VideoService);
//# sourceMappingURL=video.service.js.map