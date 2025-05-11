<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { PlaylistConfig as BasePlaylistConfig } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { AListManager } from '../../core/alist';
    import { pro } from '../../core/utils';

    interface PlaylistConfig extends BasePlaylistConfig {
        isEditing?: boolean;
        alistPath?: string;
        alistPathParts?: { name: string; path: string }[];
        folderPath?: string;
    }
    
    export let tabs: PlaylistConfig[] = [];
    export let activeTabId = 'default';
    export let i18n: any;
    export let configManager: any;
    
    // 常量与工具函数
    const MEDIA_REGEX = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i;
    const PREFIX = {tab: 'tab', folder: 'folder', bili: 'bili-fav'};
    const FIXED_ALIST_ID = 'alist-main';
    
    let isAddingTab = false;
    let newTabInput: HTMLInputElement;
    
    const dispatch = createEventDispatcher();
    const updateTabs = () => dispatch('tabsUpdate', {tabs});
    $: activeTab = tabs.find(t => t.id === activeTabId);
    
    // 工具函数
    const isElectron = () => window.navigator.userAgent.includes('Electron');
    const getDialog = () => isElectron() ? window.require('@electron/remote').dialog : null;
    const addMedia = (url, autoPlay = false) => dispatch('addMedia', {url, options: {autoPlay}}) || true;
    const needPro = fn => (e?) => pro.check(configManager.getConfig()) ? fn(e) : pro.alert(i18n);
    
    // 核心功能
    function setActiveTab(id) {
        if (id === activeTabId) return;
        activeTabId = id;
        dispatch('tabChange', {tabId: id});
        
        // AList标签处理
        if (id.startsWith(FIXED_ALIST_ID)) {
            setTimeout(() => {
                const tab = tabs.find(t => t.id === id);
                (tab && AListManager.getConfig()?.connected) 
                    ? loadAListFolder(tab.alistPath || '/') 
                    : initAList();
            }, 10);
        }
    }

    function addTab(prefix, name) {
        const id = `${prefix}-${Date.now()}`;
        tabs = [...tabs, {id, name, items: []}];
        updateTabs();
        setActiveTab(id);
        return id;
    }

    function saveTab(event, tab = null) {
        if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
        
        const input = event.target as HTMLInputElement;
        const newName = input.value.trim();
        
        tab ? tabs = tabs.map(t => t.id === tab.id ? {...t, name: newName || t.name, isEditing: false} : t)
            : newName && addTab(PREFIX.tab, newName);
        
        isAddingTab = false;
        input.value = '';
        updateTabs();
    }

    // 菜单和文件处理函数
    function showTabMenu(e, tab) {
        const menu = new Menu("tabMenu");
        
        if (!tab.isFixed) {
            menu.addItem({
                icon: "iconEdit",
                label: i18n.playList.menu.rename,
                click: () => {
                    tabs = tabs.map(t => ({...t, isEditing: t.id === tab.id}));
                    updateTabs();
                    setTimeout(() => (document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement)?.focus(), 0);
                }
            });
        }
        
        menu.addItem({
            icon: "iconRefresh",
            label: i18n.playList.menu.refresh || "刷新",
            click: () => refreshTab(tab)
        });
        
        menu.addItem({
            icon: "iconClear",
            label: i18n.playList.menu.clear,
            click: () => {
                tabs = tabs.map(t => t.id === tab.id ? {...t, items: []} : t);
                updateTabs();
                showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
            }
        });

        if (!tab.isFixed) {
            menu.addItem({
                icon: "iconTrashcan",
                label: i18n.playList.menu.delete,
                click: () => {
                    tabs = tabs.filter(t => t.id !== tab.id);
                    activeTabId === tab.id && setActiveTab('default');
                    updateTabs();
                }
            });
        }
        
        menu.open({x: e.clientX, y: e.clientY});
    }

    function showAddMenu(e) {
        const menu = new Menu("addMenu");
        const pos = {x: e.clientX, y: e.clientY};
        
        [
            {icon: "iconAdd", label: i18n.playList.menu.addNewTab, 
             click: () => { isAddingTab = true; setTimeout(() => newTabInput?.focus(), 0); }},
            {icon: "iconFolder", label: i18n.playList.menu.addLocalFolder, click: needPro(addLocalFolder)},
            {icon: "iconFile", label: i18n.playList.menu.addMediaFiles, click: needPro(addLocalFiles)},
            {icon: "iconCloud", label: i18n.playList.menu.addAList, click: needPro(initAList)},
            {icon: "iconHeart", label: i18n.playList.menu.addBilibiliFavorites, 
             click: needPro(() => showBiliFavs(pos))}
        ].forEach(item => menu.addItem(item));
        
        menu.open(pos);
    }

    // 本地文件处理
    async function addLocalFolder() {
        if (!isElectron()) return showMessage("此功能仅在思源客户端中可用");

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
            
            const tabId = addTab(PREFIX.folder, folderName);
            const tab = tabs.find(t => t.id === tabId);
            
            if (tab) {
                tab.folderPath = folderPath;
                updateTabs();
                
                let count = 0;
                (function scan(dir) {
                    fs.readdirSync(dir).forEach(file => {
                        const fullPath = path.join(dir, file);
                        fs.statSync(fullPath).isDirectory()
                            ? scan(fullPath)
                            : MEDIA_REGEX.test(file) && addMedia(`file://${fullPath.replace(/\\/g, '/')}`) && count++;
                    });
                })(folderPath);
                
                count > 0 && showMessage(i18n.playList.message.folderAdded
                    .replace('${name}', folderName)
                    .replace('${count}', count.toString()));
            }
        } catch {
            showMessage(i18n.playList.error.selectFolderFailed);
        }
    }

    function refreshTab(tab) {
        if (!tab) return;
        
        try {
            // 清空当前列表
            tab.items = [];
            updateTabs();
            
            if (tab.id.startsWith(PREFIX.folder) && tab.folderPath) {
                // 刷新本地文件夹
                if (!isElectron()) return showMessage("此功能仅在思源客户端中可用");
                
                const fs = window.require('fs'), path = window.require('path');
                let count = 0;
                (function scan(dir) {
                    fs.readdirSync(dir).forEach(file => {
                        const fullPath = path.join(dir, file);
                        fs.statSync(fullPath).isDirectory()
                            ? scan(fullPath)
                            : MEDIA_REGEX.test(file) && addMedia(`file://${fullPath.replace(/\\/g, '/')}`) && count++;
                    });
                })(tab.folderPath);
                
                showMessage(count 
                    ? (i18n.playList.message.folderRefreshed || "已刷新文件夹，添加了 ${count} 个媒体文件").replace('${count}', count.toString())
                    : (i18n.playList.message.folderRefreshedEmpty || "已刷新文件夹，未发现新媒体文件"));
            } else if (tab.id.startsWith(PREFIX.bili)) {
                // 刷新B站收藏夹
                const id = tab.id.split('-')[1];
                if (id) {
                    showMessage(i18n.playList.message.processingFavorites || "正在处理收藏夹...");
                    BilibiliParser.getFavoritesList(id, configManager.getConfig())
                        .then(({items}) => {
                            if (!items?.length) return showMessage(i18n.playList.error.emptyFavorites || "收藏夹为空");
                            
                            let count = 0;
                            items.forEach(item => {
                                try {
                                    addMedia(`https://www.bilibili.com/video/${item.bvid}`) && count++;
                                } catch {}
                            });
                            
                            showMessage((i18n.playList.message.favoritesRefreshed || "已刷新收藏夹，添加了 ${count} 个视频")
                                .replace('${count}', count.toString()));
                        })
                        .catch(() => showMessage(i18n.playList.error.processFavoritesFailed || "刷新收藏夹失败"));
                }
            } else if (tab.id.startsWith('alist-')) {
                // 刷新AList文件夹
                const path = tab.alistPath || '/';
                AListManager.createMediaItemsFromDirectory(path)
                    .then(items => {
                        tab.items = items;
                        updateTabs();
                        showMessage(i18n.playList.message.alistRefreshed || "已刷新AList目录");
                    })
                    .catch(() => showMessage(i18n.playList.error.refreshAListFailed || "刷新AList目录失败"));
            } else {
                // 默认刷新配置文件
                dispatch('reload');
                showMessage(i18n.playList.message.configRefreshed || "已刷新配置");
            }
        } catch {
            showMessage(i18n.playList.error.refreshFailed || "刷新失败");
        }
    }

    async function addLocalFiles() {
        if (!isElectron()) return showMessage("此功能仅在思源客户端中可用");

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
            result.filePaths.forEach(path => addMedia(`file://${path.replace(/\\/g, '/')}`) && count++);
            count > 0 && showMessage(i18n.playList.message.filesAdded.replace('${count}', count.toString()));
        } catch {
            showMessage(i18n.playList.error.selectMediaFilesFailed);
        }
    }

    // BiliBili功能
    async function showBiliFavs(pos) {
        try {
            const config = await configManager.getConfig();
            if (!config.bilibiliLogin?.userInfo?.mid) return showMessage(i18n.playList.error.needBiliLogin);
            
            const folders = await BilibiliParser.getUserFavoriteFolders(config);
            if (!folders?.length) return showMessage(i18n.playList.error.emptyFavFolders);
            
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
            const {title: favTitle, items} = await BilibiliParser.getFavoritesList(id, await configManager.getConfig());
            if (!items?.length) return showMessage(i18n.playList.error.emptyFavorites);
            
            addTab(PREFIX.bili, title || favTitle);
            let count = 0;
            
            for (const item of items) {
                try {
                    addMedia(`https://www.bilibili.com/video/${item.bvid}`) && count++;
                } catch {}
            }
            
            showMessage(i18n.playList.message.favoritesAdded
                .replace('${name}', title || favTitle)
                .replace('${count}', count.toString()));
        } catch {
            showMessage(i18n.playList.error.processFavoritesFailed);
        }
    }

    // AList功能
    async function loadAListFolder(path = '/'): Promise<void> {
        try {
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab || !tab.id.startsWith(FIXED_ALIST_ID)) return;
            
            if (!AListManager.getConfig()?.token) return showMessage("未连接到AList服务器");
            
            tab.alistPath = path;
            tab.alistPathParts = path.split('/').filter(Boolean)
                .map((part, i, arr) => ({ name: part, path: '/' + arr.slice(0, i + 1).join('/') }));
            
            tab.items = await AListManager.createMediaItemsFromDirectory(path);
            updateTabs();
        } catch {
            showMessage('获取文件列表失败');
        }
    }

    async function initAList() {
        try {
            if (await AListManager.initFromConfig(await configManager.getConfig())) {
                const alistTab = tabs.find(t => t.id.startsWith(FIXED_ALIST_ID));
                if (alistTab) {
                    setActiveTab(alistTab.id);
                } else {
                    const id = `${FIXED_ALIST_ID}-${Date.now()}`;
                    tabs = [...tabs, {id, name: 'AList', items: [], alistPath: '/'}];
                    updateTabs();
                    setActiveTab(id);
                }
            } else {
                showMessage("请配置AList");
            }
        } catch {
            showMessage("AList连接失败");
        }
    }

    // 初始化
    onMount(() => {
        const eventHandlers = {
            alistPathPlay: (async (event: CustomEvent) => {
                try {
                    const { path, startTime, endTime } = event.detail;
                    const mediaItem = await AListManager.createMediaItemFromPath(path, { startTime, endTime });
                    window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: mediaItem }));
                } catch {
                    showMessage('播放失败');
                }
            }) as EventListener,
            
            addAListTab: (async (event: CustomEvent) => {
                try {
                    if (!event.detail?.path) return;
                    if (!await AListManager.initFromConfig(await configManager.getConfig())) {
                        return showMessage('未连接到AList服务器');
                    }
                    
                    const path = event.detail.path;
                    const folderName = path.split('/').pop() || 'AList';
                    
                    const id = `${FIXED_ALIST_ID}-${Date.now()}`;
                    tabs = [...tabs, {id, name: folderName, items: [], alistPath: path}];
                    updateTabs();
                    setActiveTab(id);
                } catch {
                    showMessage('添加AList标签失败');
                }
            }) as EventListener
        };
        
        // 注册事件监听
        Object.entries(eventHandlers).forEach(([event, handler]) => 
            window.addEventListener(event, handler));
        
        // 初始化AList
        (async () => {
            try { 
                if (await AListManager.initFromConfig(await configManager.getConfig())) {
                    const alistTab = tabs.find(t => t.id === activeTabId && t.id.startsWith(FIXED_ALIST_ID));
                    alistTab && loadAListFolder(alistTab.alistPath || '/');
                }
            } catch {}
        })();
        
        // 返回清理函数
        return () => {
            Object.entries(eventHandlers).forEach(([event, handler]) => 
                window.removeEventListener(event, handler));
        };
    });
</script>

<!-- 标签栏 -->
<div class="playlist-tabs">
    {#each tabs as tab (tab.id)}
        {#if tab.isEditing}
            <div class="tab-edit-wrapper">
                <input id="tab-edit-{tab.id}" type="text" class="tab-input" value={tab.name}
                       on:blur={(e) => saveTab(e, tab)} on:keydown={(e) => saveTab(e, tab)}/>
            </div>
        {:else}
            <button class="tab" class:active={activeTabId === tab.id}
                    on:click={() => setActiveTab(tab.id)}
                    on:contextmenu|preventDefault={(e) => showTabMenu(e, tab)}>
                {tab.name}
            </button>
        {/if}
    {/each}
    
    <!-- 添加按钮/输入框 -->
    <div class="tab-add-wrapper">
        {#if isAddingTab}
            <input bind:this={newTabInput} type="text" class="tab-input" style="width:100px"
                   placeholder={i18n.playList.placeholder.newTab}
                   on:blur={saveTab} on:keydown={saveTab}/>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={showAddMenu}>+</button>
        {/if}
    </div>
</div>

<!-- AList路径导航栏 -->
{#if activeTab?.id?.startsWith(FIXED_ALIST_ID) && activeTab?.alistPath}
    <div class="alist-path-nav">
        <button class="path-item" on:click={() => loadAListFolder('/')}>根目录</button>
        {#each (activeTab.alistPathParts || []) as part}
            <span class="path-sep">/</span>
            <button class="path-item" on:click={() => loadAListFolder(part.path)}>{part.name}</button>
        {/each}
    </div>
{/if}