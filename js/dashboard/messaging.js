// messaging.js
export class MessagingSystem {
    constructor(user, supabase, showErrorMessage) {
        this.user = user;
        this.supabase = supabase;
        this.showErrorMessage = showErrorMessage;
        this.activeConversation = null;
        this.initialize();
    }

    initialize() {
        // Get DOM elements
        this.messagesList = document.getElementById('messages-container');
        this.conversationsList = document.getElementById('conversations-list');
        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        this.chatHeader = document.getElementById('chat-header');
        
        // Initialize the system
        this.setupEventListeners();
        this.loadConversations();
        this.setupRealtimeSubscription();
    }

    formatTime(timeString) {
        if (!timeString) return 'Invalid Time';
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        const formattedMinutes = String(minutes).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes} ${period}`;
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.activeConversation) {
                this.sendMessage(this.messageInput.value);
                this.messageInput.value = '';
            }
        });
    }

    async loadConversations() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            console.log('Loading conversations for date:', today);
            
            // Get confirmed upcoming performances
            const { data: performances, error } = await this.supabase
                .from('performances')
                .select(`
                    *,
                    performers (
                        id,
                        stage_name
                    )
                `)
                .eq('venue_id', this.user.id)
                .eq('status', 'confirmed')
                .gte('date', today)
                .order('date', { ascending: true });
    
            console.log('Performances found:', performances);
    
            if (error) throw error;
    
            // Create unique conversations from performances
            const uniquePerformers = [...new Map(
                performances.map(p => [p.performer_id, {
                    id: p.performer_id,
                    stage_name: p.performers.stage_name,
                    next_performance: p.date,
                    start_time: p.start_time
                }])
            ).values()];
    
            console.log('Unique performers:', uniquePerformers);
    
            this.renderConversationsList(uniquePerformers);
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.showErrorMessage('Failed to load conversations');
        }
    }

    renderConversationsList(performers) {
        this.conversationsList.innerHTML = performers.map(performer => `
            <div 
                class="px-6 py-4 border-b border-black/10 hover:bg-black/5 cursor-pointer"
                data-performer-id="${performer.id}"
                onclick="window.messagingSystem.selectConversation('${performer.id}', '${performer.stage_name}')"
            >
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <span class="text-indigo-600 font-medium">
                            ${performer.stage_name.charAt(0)}
                        </span>
                    </div>
                    <div>
                        <h3 class="font-medium text-black">${performer.stage_name}</h3>
                        <p class="text-sm text-gray-500">
                            Next performance: ${new Date(performer.next_performance).toLocaleDateString()} at ${this.formatTime(performer.start_time)}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async selectConversation(performerId, performerName) {
        this.activeConversation = performerId;
        this.chatHeader.textContent = performerName;
        this.messageInput.disabled = false;
        this.messageForm.querySelector('button').disabled = false;
        
        // Create a unique conversation ID
        const conversationId = [this.user.id, performerId].sort().join('_');
        
        try {
            // Load messages
            const { data: messages, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            
            // Mark messages as read
            await this.markMessagesAsRead(conversationId);
            
            this.renderMessages(messages);
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showErrorMessage('Failed to load messages');
        }
    }

    async markMessagesAsRead(conversationId) {
        try {
            const { error } = await this.supabase
                .from('messages')
                .update({ read: true })
                .eq('conversation_id', conversationId)
                .eq('receiver_id', this.user.id)
                .eq('read', false);

            if (error) throw error;
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    renderMessages(messages) {
        this.messagesList.innerHTML = messages.map(message => `
            <div class="mb-4 ${message.sender_id === this.user.id ? 'text-right' : ''}">
                <div class="inline-block px-4 py-2 rounded-lg ${
                    message.sender_id === this.user.id 
                        ? 'bg-indigo-500 text-white' 
                        : 'bg-black/5 text-black'
                }">
                    ${message.message}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    ${new Date(message.created_at).toLocaleTimeString()}
                </div>
            </div>
        `).join('');
        
        // Scroll to bottom of messages
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    async sendMessage(content) {
        if (!content.trim() || !this.activeConversation) return;

        const conversationId = [this.user.id, this.activeConversation].sort().join('_');
        
        try {
            const { error } = await this.supabase
                .from('messages')
                .insert([{
                    sender_id: this.user.id,
                    receiver_id: this.activeConversation,
                    message: content,
                    conversation_id: conversationId,
                    sender_type: 'venue',
                    receiver_type: 'performer'
                }]);

            if (error) throw error;
        } catch (error) {
            console.error('Error sending message:', error);
            this.showErrorMessage('Failed to send message');
        }
    }

    setupRealtimeSubscription() {
        this.supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, payload => {
                if (payload.new.conversation_id.includes(this.user.id)) {
                    this.handleNewMessage(payload.new);
                }
            })
            .subscribe();
    }

    handleNewMessage(message) {
        // If this is the active conversation, add the message to the display
        if (this.activeConversation && 
            message.conversation_id.includes(this.activeConversation)) {
            this.renderMessages([...Array.from(this.messagesList.children), message]);
        }
        
        // If message is received and conversation isn't active, show unread indicator
        if (!this.activeConversation || 
            !message.conversation_id.includes(this.activeConversation)) {
            this.updateUnreadIndicator(message);
        }
    }

    updateUnreadIndicator(message) {
        // Find the conversation in the list and add unread indicator
        const conversationElement = this.conversationsList
            .querySelector(`[data-performer-id="${message.sender_id}"]`);
            
        if (conversationElement) {
            const unreadIndicator = document.createElement('div');
            unreadIndicator.className = 'w-2 h-2 bg-indigo-500 rounded-full absolute top-4 right-4';
            conversationElement.appendChild(unreadIndicator);
        }
    }
}