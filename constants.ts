import { AspectRatio, ImageEngine, AIEngine } from './types';

export const STYLE_CATEGORIES = [
    {
        id: 'custom',
        name: '自定义风格',
        subStyles: [
            { name: '自定义', value: '', isCustom: true }
        ]
    },
    {
        id: 'cinematic',
        name: '电影质感',
        subStyles: [
            { name: '王家卫风格', value: 'Wong Kar-wai style, moody lighting, saturated colors, step-printing effect, nostalgic Hong Kong cinema aesthetic, neon glow' },
            { name: '韦斯·安德森', value: 'Wes Anderson style, perfectly symmetrical composition, pastel color palette, whimsical flat lay design, center-framed' },
            { name: '新好莱坞', value: 'Modern Hollywood blockbuster aesthetic, anamorphic lens flares, rich blacks, teal and orange highlights, cinematic grain' }
        ]
    },
    {
        id: 'art',
        name: '艺术风格',
        subStyles: [
            { name: '极致极简', value: 'Minimalist cinematography, monochromatic lighting, negative space, soft shadows, clean geometry' },
            { name: '新海诚风', value: 'Makoto Shinkai movie style, hyper-detailed backgrounds, beautiful lens flare, emotive sunset lighting, vast blue sky gradients' }
        ]
    }
];

export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
    { label: '16:9 宽屏', value: '16:9' },
    { label: '9:16 竖屏', value: '9:16' }
];

export const IMAGE_ENGINES: { label: string; value: ImageEngine; desc: string }[] = [
    { label: 'NB2 引擎', value: 'nb2', desc: '专业级角色一致性 (默认)' },
    { label: 'RunningHub (Qwen)', value: 'runninghub', desc: '次世代写实模型' },
    { label: 'Z-image', value: 'z_image', desc: '资产专属模型' }
];

export const VIDEO_ENGINES: { label: string; value: AIEngine; desc: string }[] = [
    { label: 'Wan 2.2 (跑站)', value: 'wan2_2', desc: '工作流图生视频' },
    { label: 'Vidu Q2 Pro', value: 'vidu_q2', desc: 'Vidu 原生 API' },
    { label: 'See Dance 1.5', value: 'seedance_1_5', desc: '原生 API' }
];

export const SHOT_TYPES = [
    { value: 'CU', label: '特写' },
    { value: 'MS', label: '中景' },
    { value: 'LS', label: '全景' },
    { value: 'POV', label: '主观视角' }
] as const;

export const CAMERA_MOVEMENTS = [
    { value: 'Fixed', label: '固定' },
    { value: 'Dolly In', label: '推' },
    { value: 'Dolly Out', label: '拉' },
    { value: 'Pan', label: '摇' },
    { value: 'Tilt', label: '移' },
    { value: 'Orbit', label: '环绕' },
] as const;

export const CAMERA_ANGLES = [
    { value: 'Cinematic Eye-level', label: '平视 (标准)' },
    { value: 'Low Angle', label: '低角度 (俯拍)' },
    { value: 'High Angle', label: '高角度 (仰拍)' },
    { value: 'Bird Eye View', label: '鸟瞰/上帝视角' },
    { value: 'Extreme Low Angle', label: '极端低角度' },
    { value: 'Dutch Angle', label: '荷兰斜角' },
] as const;

export const COMPOSITION_SHOTS = [
    { value: 'Standard', label: '标准构图', desc: '常规镜头' },
    { value: 'OTS', label: '过肩镜头 (OTS)', desc: '从一个人肩膀后拍另一个人。拍对话最常用，自然、有互动感。' },
    { value: 'Reverse Shot', label: '正反打', desc: 'A→B→A→B 交替切。标准对话镜头，观众最习惯。' },
    { value: 'POV', label: '主观镜头 (POV)', desc: '以角色眼睛看出去。代入感、惊吓、窥视。' },
    { value: 'Low Angle', label: '低角度', desc: '从下往上拍。权力、强大、压迫、英雄感。' },
    { value: 'High Angle', label: '高角度', desc: '从上往下拍。弱势、孤独、上帝视角。' },
    { value: 'Deep Focus', label: '景深镜头', desc: '前景、中景、背景都清晰。同时展示多层信息。' },
    { value: 'Shallow Focus', label: '浅景深', desc: '人清晰，背景模糊。突出主体、唯美、电影感。' },
] as const;

export const EXAMPLE_SCRIPTS = [
    {
        name: '🎬 科幻短片',
        description: '时空穿越主题，预计 6-8 个镜头',
        content: `【场景】2087年，废弃的东京地铁站

小林站在月台边缘，雨水从天花板的裂缝中滴落。她的全息手环闪烁着微弱的蓝光。

小林：（低声）"你确定这是正确的坐标吗？"

AI助手（画外音）："误差范围在 0.3 米内。时间裂缝将在 47 秒后出现。"

一道紫色的光芒在轨道上空撕裂，空气开始扭曲。小林深吸一口气，握紧了手中的记忆芯片。

小林：（自言自语）"妈妈...我来了。"

她纵身跃入光芒之中。`
    },
    {
        name: '💕 都市爱情',
        description: '雨夜重逢，预计 5-7 个镜头',
        content: `【场景】雨夜，咖啡馆的落地窗前

苏晴独自坐在角落的位置，面前的咖啡已经凉了。她反复看着手机上的对话记录。

门铃响起。陈霄推门走进来，浑身湿透。

苏晴抬起头，两人目光相遇。

苏晴：（声音颤抖）"你说你不会来的。"

陈霄：（走近）"我说过的话很多，但只有一句是真的。"

他在她面前蹲下，握住她的手。

陈霄："我爱你。从第一天起，到最后一天。"

苏晴的眼泪终于落下。窗外的雨，仿佛也温柔了几分。`
    },
    {
        name: '🔍 悬疑推理',
        description: '密室谜题，预计 8-10 个镜头',
        content: `【场景】深夜，古老的图书馆密室

侦探林默站在书架前，手电筒的光束扫过一排排泛黄的书籍。

林默：（自言自语）"第三排，第七本...应该就是这里。"

他抽出一本厚重的古书，书架突然发出咔嚓声，缓缓向一侧移动，露出一道暗门。

暗门后传来微弱的呼吸声。

林默握紧手枪，小心翼翼地走进去。房间中央，一个蒙面人背对着他。

蒙面人：（不回头）"你终于来了，林侦探。我等你很久了。"

林默："游戏结束了。摘下面具吧。"

蒙面人缓缓转身，摘下面具——竟是林默自己的脸！`
    },
    {
        name: '😂 喜剧小品',
        description: '职场囧事，预计 6-8 个镜头',
        content: `【场景】办公室，周一早晨

小王匆匆忙忙冲进办公室，手里拿着豆浆和油条，头发乱糟糟的。

小王：（气喘吁吁）"不好意思不好意思，地铁延误了！"

他一抬头，发现整个办公室空无一人，只有老板坐在会议室里，透过玻璃冷冷地看着他。

小王看了看手机——今天是周六。

小王：（欲哭无泪）"我...我以为今天是周一..."

老板走出来，拍了拍他的肩膀。

老板："既然来了，帮我整理一下这个月的报表吧。正好我也加班。"

小王：（崩溃）"我就知道...我就知道会这样！"`
    },
    {
        name: '⚔️ 武侠动作',
        description: '江湖恩怨，预计 10-12 个镜头',
        content: `【场景】竹林深处，晨雾弥漫

剑客独孤求败站在竹林中央，手持长剑，闭目养神。

远处传来破空之声，三道黑影从竹梢飞掠而来。

黑衣人甲："独孤求败，今日就是你的死期！"

独孤求败睁开双眼，嘴角微微上扬。

独孤求败："三个人？看来你们还是太小看我了。"

话音未落，他的身影已消失在原地。剑光如流星般在竹林中穿梭。

不到三招，三名黑衣人已倒地不起。

独孤求败收剑入鞘，转身离去。

独孤求败：（背影）"无敌，真是寂寞啊。"`
    }
];
