var FMOD = {};
var system;
var coresystem;
var gAudioResumed  = false;
var music_instance;

function prerun() {  
    FMOD.FS_createPreloadedFile("/", "Master.bank", "audio/Master.bank", true, false);
    FMOD.FS_createPreloadedFile("/", "Master.strings.bank", "audio/Master.strings.bank", true, false)
    
    
}

function update_fmod() {
    system.update();
}

function main() {
    let outval = {};
    FMOD.Studio_System_Create(outval);
    system = outval.val;
    system.getCoreSystem(outval);
    coresystem = outval.val;
    system.initialize(16, FMOD.STUDIO_INIT_NORMAL, FMOD.INIT_NORMAL, null);
    system.loadBankFile("/Master.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, {});
    system.loadBankFile("/Master.strings.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, {});
    
    window.setInterval(update_fmod, 20);
    
    function resumeAudio()
    {
        if (!gAudioResumed)
        {
            console.log("Resetting audio driver based on user input.");

            coresystem.mixerSuspend();
            coresystem.mixerResume();

            gAudioResumed = true;
        }

    }

    let canvas = document.getElementById('canvas');
    canvas.addEventListener('touchend', resumeAudio, false);
    canvas.addEventListener('click', resumeAudio);
}

function set_volume(volume) {
    if(music_instance) {
        music_instance.setVolume(volume);
    }
}

function start_music(volume) {
    let outval = {};
    system.getEvent("event:/music", outval)
    let event = outval.val;
    event.createInstance(outval)
    music_instance = outval.val;
    music_instance.start()
    music_instance.release()
    music_instance.setVolume(volume)
}

function stop_music() {
    if(music_instance) {
        music_instance.setParameterByName("fade", 1, false);
    }
    music_instance = null;
}

function set_parameter(name, value) {
    if (music_instance) {
        music_instance.setParameterByName(name, value, false)
        system.flushCommands()
    }
}

async function start_oneshot(name) {
    if (music_instance) {
        music_instance.setParameterByName(name, 1, false)
        system.flushCommands()
    }
}

function restart_music() {
    if(music_instance) {
        let outval = {};
        music_instance.getTimelinePosition(outval);
        if (outval.val > 66000) {
            music_instance.setTimelinePosition(0);
        }
    }
}



FMOD['preRun'] = prerun;
FMOD['onRuntimeInitialized'] = main;
FMODModule(FMOD);


