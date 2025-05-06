<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { PlaylistConfig as BasePlaylistConfig } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { AListManager } from '../../core/alist';
    import { checkProEnabled, showProFeatureNotEnabledMessage } from '../../core/utils';
    import { DEFAULT_THUMBNAILS } from "../../core/media";

    interface PlaylistConfig extends BasePlaylistConfig {
        isEditing?: boolean;
        alistPath?: string;
        alistPathParts?: { name: string; path: string }[];
    }
    export let tabs: PlaylistConfig[] = [];
    export let activeTabId = 'default';
    export let i18n: any;
    export let configManager: any;
    
    const MEDIA_REGEX = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i;
    const PREFIX = {tab: 'tab', folder: 'folder', bili: 'bili-fav', alist: 'alist'};
    let isAddingTab = false, newTabInput: HTMLInputElement;
    
    const dispatch = createEventDispatcher<{
        tabChange: { tabId: string };
        tabsUpdate: { tabs: PlaylistConfig[] };
        addMedia: { url: string; options?: { autoPlay?: boolean } };
    }>();

    // 工具函数
    const isElectron = () => window.navigator.userAgent.includes('Electron');
    const getDialog = () => isElectron() ? window.require('@electron/remote').dialog : null;
    const createId = (prefix) => `${prefix}-${Date.now()}`;
    const updateTabs = () => dispatch('tabsUpdate', {tabs});
    const emitTabChange = (id) => dispatch('tabChange', {tabId: id});
    const addMedia = (url, autoPlay = false) => {
        dispatch('addMedia', {url, options: {autoPlay}});
        return true;
    };
    const needPro = (fn) => (e?) => checkProEnabled(configManager.getConfig()) 
        ? fn(e) 
        : showProFeatureNotEnabledMessage(i18n);
    
    // 标签管理
    function setActiveTab(id) {
        activeTabId = id;
        emitTabChange(id);
        
        if (id.startsWith('alist-')) {
            const tab = tabs.find(t => t.id === id);
            if (tab) setTimeout(() => {
                try {
                    AListManager.getConfig()?.connected 
                        ? loadAListFolder(tab.alistPath || '/') 
                        : initAList();
                } catch {
                    showMessage('AList加载失败');
                }
            }, 10);
        }
    }

    function addTab(prefix, name) {
        const id = createId(prefix);
        tabs = [...tabs, {id, name, items: []}];
        updateTabs();
        setActiveTab(id);
        return id;
    }

    function saveTab(event, tab = null) {
        if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
        
        const input = event.target as HTMLInputElement;
        const newName = input.value.trim();
        
        if (tab) {
            tabs = tabs.map(t => t.id === tab.id 
                ? {...t, name: newName || t.name, isEditing: false} 
                : t
            );
        } else if (newName) {
            addTab(PREFIX.tab, newName);
        }
        
        isAddingTab = false;
        input.value = '';
        updateTabs();
    }

    // 菜单
    function showTabMenu(e, tab) {
        const menu = new Menu("tabMenu");
        const menuItems = [];
        
        if (!tab.isFixed) {
            menuItems.push({
                icon: "iconEdit",
                label: i18n.playList.menu.rename,
                click: () => {
                    tabs = tabs.map(t => ({...t, isEditing: t.id === tab.id}));
                    updateTabs();
                    setTimeout(() => {
                        const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
                        input?.focus();
                    }, 0);
                }
            }, {
                icon: "iconTrashcan",
                label: i18n.playList.menu.delete,
                click: () => {
                    tabs = tabs.filter(t => t.id !== tab.id);
                    if (activeTabId === tab.id) setActiveTab('default');
                    updateTabs();
                }
            });
        }
        
        menuItems.push({
            icon: "iconClear",
            label: i18n.playList.menu.clear,
            click: () => {
                tabs = tabs.map(t => t.id === tab.id ? {...t, items: []} : t);
                updateTabs();
                showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
            }
        });
        
        menuItems.forEach(item => menu.addItem(item));
        menu.open({x: e.clientX, y: e.clientY});
    }

    function showAddMenu(e) {
        const menu = new Menu("addMenu");
        const pos = {x: e.clientX, y: e.clientY};
        
        [{
            icon: "iconAdd",
            label: i18n.playList.menu.addNewTab,
            click: () => {
                isAddingTab = true;
                setTimeout(() => newTabInput?.focus(), 0);
            }
        }, {
            icon: "iconFolder",
            label: i18n.playList.menu.addLocalFolder,
            click: needPro(addLocalFolder)
        }, {
            icon: "iconFile",
            label: i18n.playList.menu.addMediaFiles,
            click: needPro(addLocalFiles)
        }, {
            icon: "iconCloud",
            label: i18n.playList.menu.addAList,
            click: needPro(initAList)
        }, {
            icon: "iconHeart",
            label: i18n.playList.menu.addBilibiliFavorites,
            click: needPro(() => showBiliFavs(pos))
        }].forEach(item => menu.addItem(item));
        
        menu.open(pos);
    }

    // 本地文件
    async function addLocalFolder() {
        if (!isElectron()) {
            showMessage("此功能仅在思源客户端中可用");
            return;
        }

        try {
            const result = await getDialog().showOpenDialog({
                title: i18n.playList.dialog.selectFolder,
                buttonLabel: i18n.playList.dialog.select,
                properties: ['openDirectory', 'createDirectory']
            });

            if (result.canceled || !result.filePaths.length) return;

            const fs = window.require('fs'), path = window.require('path');
            const folderPath = result.filePaths[0];
            const folderName = folderPath.split(/[\\/]/).pop();
            
            addTab(PREFIX.folder, folderName);
            let count = 0;

            (function scan(dir) {
                fs.readdirSync(dir).forEach(file => {
                    const fullPath = path.join(dir, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        scan(fullPath);
                    } else if (MEDIA_REGEX.test(file)) {
                        const url = `file://${fullPath.replace(/\\/g, '/')}`;
                        if (addMedia(url)) count++;
                    }
                });
            })(folderPath);
            
            if (count > 0) {
                showMessage(i18n.playList.message.folderAdded
                    .replace('${name}', folderName)
                    .replace('${count}', count.toString()));
            }
        } catch {
            showMessage(i18n.playList.error.selectFolderFailed);
        }
    }

    async function addLocalFiles() {
        if (!isElectron()) {
            showMessage("此功能仅在思源客户端中可用");
            return;
        }

        try {
            const result = await getDialog().showOpenDialog({
                title: i18n.playList.dialog.selectMedia,
                buttonLabel: i18n.playList.dialog.select,
                properties: ['openFile', 'multiSelections'],
                filters: [{
                    name: i18n.playList.dialog.mediaFiles,
                    extensions: ['mp3','wav','ogg','m4a','flac','aac','mp4',
                                'webm','mkv','avi','mov','wmv','flv']
                }]
            });

            if (result.canceled || !result.filePaths.length) return;

            let count = 0;
            result.filePaths.forEach(path => {
                const url = `file://${path.replace(/\\/g, '/')}`;
                if (addMedia(url)) count++;
            });

            if (count > 0) {
                showMessage(i18n.playList.message.filesAdded.replace('${count}', count.toString()));
            }
        } catch {
            showMessage(i18n.playList.error.selectMediaFilesFailed);
        }
    }

    // B站收藏夹
    async function showBiliFavs(pos) {
        try {
            const config = await configManager.getConfig();
            
            if (!config.bilibiliLogin?.userInfo?.mid) {
                showMessage(i18n.playList.error.needBiliLogin);
                return;
            }
            
            const folders = await BilibiliParser.getUserFavoriteFolders(config);
            if (!folders?.length) {
                showMessage(i18n.playList.error.emptyFavFolders);
                return;
            }
            
            const menu = new Menu("biliFavs");
            folders.forEach(folder => {
                menu.addItem({
                    icon: "iconHeart",
                    label: `${folder.title} (${folder.media_count})`,
                    click: needPro(() => addBiliFav(folder.id.toString(), folder.title))
                });
            });
            
            menu.open(pos);
        } catch {
            showMessage(i18n.playList.error.getFavFoldersFailed);
        }
    }

    async function addBiliFav(id, title) {
        showMessage(i18n.playList.message.processingFavorites);
        
        try {
            const {title: favTitle, items} = await BilibiliParser.getFavoritesList(
                id, await configManager.getConfig()
            );
            
            if (!items?.length) {
                showMessage(i18n.playList.error.emptyFavorites);
                return;
            }
            
            addTab(PREFIX.bili, title || favTitle);
            let count = 0;
            
            for (const item of items) {
                try {
                    if (addMedia(`https://www.bilibili.com/video/${item.bvid}`)) count++;
                } catch {}
            }
            
            showMessage(i18n.playList.message.favoritesAdded
                .replace('${name}', title || favTitle)
                .replace('${count}', count.toString()));
        } catch {
            showMessage(i18n.playList.error.processFavoritesFailed);
        }
    }

    // AList
    async function loadAListFolder(path = '/') {
        try {
            let tab = tabs.find(t => t.id === activeTabId);
            
            if (!tab || !tab.id.startsWith('alist-')) {
                const name = path === '/' ? 'AList' : path.split('/').pop() || 'AList';
                tab = tabs.find(t => t.id === addTab(PREFIX.alist, name));
                if (!tab) return;
            }
            
            const files = await AListManager.listFiles(path);
            tab.alistPath = path;
            tab.alistPathParts = path.split('/').filter(Boolean).map((part, i, arr) => ({
                name: part, path: '/' + arr.slice(0, i + 1).join('/')
            }));
            tab.items = [];
            
            for (const file of files) {
                if (file.is_dir) {
                    tab.items.push({
                        id: createId('alist'),
                        title: file.name,
                        type: 'folder',
                        url: '#',
                        source: 'alist',
                        sourcePath: `${path === '/' ? '' : path}/${file.name}`,
                        is_dir: true,
                        thumbnail: DEFAULT_THUMBNAILS.folder
                    });
                } else if (AListManager.isMediaFile(file)) {
                    const item = await AListManager.createMediaItem(file, path);
                    if (item) tab.items.push(item);
                }
            }
            
            tabs = [...tabs];
            updateTabs();
        } catch {
            showMessage('加载文件夹失败');
        }
    }

    async function initAList() {
        try {
            if (await AListManager.initFromConfig(await configManager.getConfig())) {
                loadAListFolder('/');
            } else {
                showMessage("请配置AList");
            }
        } catch {
            showMessage("AList连接失败");
        }
    }

    // 生命周期
    onMount(async () => {
        window.addEventListener('biliLoginStatusChange', (() => {}) as EventListener);
        try { await AListManager.initFromConfig(await configManager.getConfig()); } catch {}
    });
    
    onDestroy(() => {
        window.removeEventListener('biliLoginStatusChange', (() => {}) as EventListener);
    });
</script>

<div class="playlist-tabs">
    {#each tabs as tab (tab.id)}
        {#if tab.isEditing}
            <div class="tab-edit-wrapper">
                <input id="tab-edit-{tab.id}" type="text" class="tab-input" 
                       value={tab.name}
                       on:blur={(e) => saveTab(e, tab)} 
                       on:keydown={(e) => saveTab(e, tab)}/>
            </div>
        {:else}
            <button class="tab" class:active={activeTabId === tab.id}
                    on:click={() => setActiveTab(tab.id)}
                    on:contextmenu|preventDefault={(e) => showTabMenu(e, tab)}>
                {tab.name}
            </button>
        {/if}
    {/each}
    
    <div class="tab-add-wrapper">
        {#if isAddingTab}
            <input bind:this={newTabInput} type="text" class="tab-input" style="width:100px"
                   placeholder={i18n.playList.placeholder.newTab}
                   on:blur={(e) => saveTab(e)} 
                   on:keydown={(e) => saveTab(e)}/>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={showAddMenu}>+</button>
        {/if}
    </div>
</div>

{#if tabs.find(tab => tab.id === activeTabId)?.alistPath}
    {@const activeTab = tabs.find(tab => tab.id === activeTabId)}
    <div class="alist-path-nav">
        <button class="path-item" on:click={() => loadAListFolder('/')}>根目录</button>
        {#each activeTab.alistPathParts || [] as part}
            <span class="path-sep">/</span>
            <button class="path-item" on:click={() => loadAListFolder(part.path)}>{part.name}</button>
        {/each}
    </div>
{/if}