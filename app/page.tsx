'use client'

import { useState, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, MessageSquare, Clock, CheckCircle, AlertTriangle, Search, Send, User, RefreshCw, Upload, ChevronRight, X } from 'lucide-react'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'

// TypeScript Interfaces based on actual agent response structure
interface AgentResponse {
  status: string
  result: {
    response_message: string
    knowledge_base_used: boolean
    intercom_action_taken: string
    escalation_needed: boolean
    conversation_id: string
  }
  metadata?: Record<string, any>
}

interface Message {
  id: string
  sender: 'customer' | 'agent'
  content: string
  timestamp: Date
  isTyping?: boolean
}

interface Conversation {
  id: string
  customerName: string
  customerEmail: string
  lastMessage: string
  status: 'active' | 'resolved' | 'escalated'
  timestamp: Date
  messageCount: number
  messages: Message[]
}

export default function Home() {
  const AGENT_ID = '698599d07551cb7920ffe924'
  const RAG_ID = '698599b5de7de278e55d2877'

  // Screen state
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'conversations' | 'knowledge' | 'chat'>('dashboard')

  // Dashboard metrics
  const [metrics, setMetrics] = useState({
    totalConversations: 0,
    avgResponseTime: '0s',
    resolutionRate: 0,
    activeChats: 0
  })

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversationFilter, setConversationFilter] = useState<'all' | 'active' | 'resolved' | 'escalated'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Chat widget state
  const [chatExpanded, setChatExpanded] = useState(false)
  const [currentMessages, setCurrentMessages] = useState<Message[]>([])
  const [userMessage, setUserMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [showCustomerForm, setShowCustomerForm] = useState(true)

  // Knowledge base state
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isCrawling, setIsCrawling] = useState(false)
  const [indexedPages, setIndexedPages] = useState<Array<{ url: string; lastUpdated: Date }>>([])

  // Initialize demo data
  useEffect(() => {
    const demoConversations: Conversation[] = [
      {
        id: 'conv_001',
        customerName: 'Sarah Johnson',
        customerEmail: 'sarah.j@example.com',
        lastMessage: 'Thank you for the help!',
        status: 'resolved',
        timestamp: new Date(Date.now() - 3600000),
        messageCount: 8,
        messages: [
          { id: 'm1', sender: 'customer', content: 'Hi, I need help with my order', timestamp: new Date(Date.now() - 7200000) },
          { id: 'm2', sender: 'agent', content: 'Hello! I\'d be happy to help you with your order. Could you please provide your order number?', timestamp: new Date(Date.now() - 7000000) },
        ]
      },
      {
        id: 'conv_002',
        customerName: 'Michael Chen',
        customerEmail: 'michael.c@example.com',
        lastMessage: 'Is there a human available?',
        status: 'escalated',
        timestamp: new Date(Date.now() - 1800000),
        messageCount: 5,
        messages: [
          { id: 'm3', sender: 'customer', content: 'I have a complex billing issue', timestamp: new Date(Date.now() - 3600000) },
          { id: 'm4', sender: 'agent', content: 'I understand you have a billing concern. Let me help you with that.', timestamp: new Date(Date.now() - 3400000) },
        ]
      },
      {
        id: 'conv_003',
        customerName: 'Emily Rodriguez',
        customerEmail: 'emily.r@example.com',
        lastMessage: 'What are your business hours?',
        status: 'active',
        timestamp: new Date(Date.now() - 300000),
        messageCount: 2,
        messages: [
          { id: 'm5', sender: 'customer', content: 'What are your business hours?', timestamp: new Date(Date.now() - 300000) },
        ]
      }
    ]

    setConversations(demoConversations)

    setMetrics({
      totalConversations: demoConversations.length,
      avgResponseTime: '2.3s',
      resolutionRate: 87,
      activeChats: demoConversations.filter(c => c.status === 'active').length
    })

    setIndexedPages([
      { url: 'https://example.com/pricing', lastUpdated: new Date(Date.now() - 86400000) },
      { url: 'https://example.com/features', lastUpdated: new Date(Date.now() - 86400000) },
      { url: 'https://example.com/support', lastUpdated: new Date(Date.now() - 172800000) },
    ])
  }, [])

  // Handle chat message send
  const handleSendMessage = async () => {
    if (!userMessage.trim() || isLoading) return

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      sender: 'customer',
      content: userMessage,
      timestamp: new Date()
    }

    setCurrentMessages(prev => [...prev, newMessage])
    setUserMessage('')
    setIsLoading(true)

    // Add typing indicator
    const typingMessage: Message = {
      id: 'typing',
      sender: 'agent',
      content: '',
      timestamp: new Date(),
      isTyping: true
    }
    setCurrentMessages(prev => [...prev, typingMessage])

    try {
      const result = await callAIAgent(userMessage, AGENT_ID)

      // Remove typing indicator
      setCurrentMessages(prev => prev.filter(m => m.id !== 'typing'))

      if (result.success && result.response) {
        const agentResponse = result.response as AgentResponse

        const agentMessage: Message = {
          id: `msg_${Date.now()}_agent`,
          sender: 'agent',
          content: agentResponse.result?.response_message || agentResponse.status || 'I apologize, but I encountered an issue. Please try again.',
          timestamp: new Date()
        }

        setCurrentMessages(prev => [...prev, agentMessage])

        // Handle escalation if needed
        if (agentResponse.result?.escalation_needed) {
          // Update conversation status to escalated
          const conversationId = agentResponse.result.conversation_id || `conv_${Date.now()}`
          setConversations(prev => prev.map(conv =>
            conv.id === conversationId ? { ...conv, status: 'escalated' } : conv
          ))
        }
      } else {
        const errorMessage: Message = {
          id: `msg_${Date.now()}_error`,
          sender: 'agent',
          content: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
          timestamp: new Date()
        }
        setCurrentMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      setCurrentMessages(prev => prev.filter(m => m.id !== 'typing'))
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        sender: 'agent',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setCurrentMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle conversation actions
  const handleMarkResolved = () => {
    if (selectedConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === selectedConversation.id ? { ...conv, status: 'resolved' } : conv
      ))
      setSelectedConversation(prev => prev ? { ...prev, status: 'resolved' } : null)
    }
  }

  const handleEscalate = () => {
    if (selectedConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === selectedConversation.id ? { ...conv, status: 'escalated' } : conv
      ))
      setSelectedConversation(prev => prev ? { ...prev, status: 'escalated' } : null)
    }
  }

  // Handle knowledge base crawl
  const handleCrawlWebsite = async () => {
    if (!websiteUrl.trim()) return
    setIsCrawling(true)

    // Simulate crawling delay
    setTimeout(() => {
      setIndexedPages(prev => [
        { url: websiteUrl, lastUpdated: new Date() },
        ...prev
      ])
      setIsCrawling(false)
      setWebsiteUrl('')
    }, 2000)
  }

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesFilter = conversationFilter === 'all' || conv.status === conversationFilter
    const matchesSearch = conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'escalated': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  // Start new chat
  const handleStartChat = () => {
    if (!customerName.trim() || !customerEmail.trim()) return
    setShowCustomerForm(false)

    const welcomeMessage: Message = {
      id: 'welcome',
      sender: 'agent',
      content: `Hello ${customerName}! Welcome to OmniServe Support. How can I help you today?`,
      timestamp: new Date()
    }
    setCurrentMessages([welcomeMessage])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">OmniServe AI</h1>
              <p className="text-sm text-gray-500">Customer Service Platform</p>
            </div>
            <nav className="flex gap-2">
              <Button
                variant={activeScreen === 'dashboard' ? 'default' : 'outline'}
                onClick={() => setActiveScreen('dashboard')}
                className={activeScreen === 'dashboard' ? 'bg-[#2563EB]' : ''}
              >
                Dashboard
              </Button>
              <Button
                variant={activeScreen === 'conversations' ? 'default' : 'outline'}
                onClick={() => setActiveScreen('conversations')}
                className={activeScreen === 'conversations' ? 'bg-[#2563EB]' : ''}
              >
                Conversations
              </Button>
              <Button
                variant={activeScreen === 'knowledge' ? 'default' : 'outline'}
                onClick={() => setActiveScreen('knowledge')}
                className={activeScreen === 'knowledge' ? 'bg-[#2563EB]' : ''}
              >
                Knowledge Base
              </Button>
              <Button
                variant={activeScreen === 'chat' ? 'default' : 'outline'}
                onClick={() => setActiveScreen('chat')}
                className={activeScreen === 'chat' ? 'bg-[#2563EB]' : ''}
              >
                Test Chat
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Dashboard Screen */}
        {activeScreen === 'dashboard' && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Conversations</CardTitle>
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{metrics.totalConversations}</div>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{metrics.avgResponseTime}</div>
                  <p className="text-xs text-green-600 mt-1">-15% from last week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Resolution Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{metrics.resolutionRate}%</div>
                  <p className="text-xs text-green-600 mt-1">+3% from last week</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Active Chats</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{metrics.activeChats}</div>
                  <p className="text-xs text-gray-500 mt-1">Currently active</p>
                </CardContent>
              </Card>
            </div>

            {/* Escalation Alerts */}
            {conversations.filter(c => c.status === 'escalated').length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                    <AlertTriangle className="h-5 w-5" />
                    Pending Human Handoffs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {conversations.filter(c => c.status === 'escalated').map(conv => (
                      <div key={conv.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-200">
                        <div>
                          <p className="font-medium text-gray-900">{conv.customerName}</p>
                          <p className="text-sm text-gray-500">{conv.lastMessage}</p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-[#2563EB]"
                          onClick={() => {
                            setSelectedConversation(conv)
                            setActiveScreen('conversations')
                          }}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Conversations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Conversations</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveScreen('conversations')}
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conversations.slice(0, 5).map(conv => (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedConversation(conv)
                        setActiveScreen('conversations')
                      }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-10 w-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-medium">
                          {conv.customerName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{conv.customerName}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(conv.status)}`}>
                              {conv.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{formatTime(conv.timestamp)}</p>
                        <p className="text-xs text-gray-400">{conv.messageCount} messages</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveScreen('conversations')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-[#2563EB]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">View All Conversations</h3>
                      <p className="text-sm text-gray-500">Manage customer interactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveScreen('knowledge')}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Manage Knowledge Base</h3>
                      <p className="text-sm text-gray-500">Update indexed content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Conversations Screen */}
        {activeScreen === 'conversations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Conversation List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conversations</CardTitle>
                  <div className="mt-4 space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={conversationFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => setConversationFilter('all')}
                        className={conversationFilter === 'all' ? 'bg-[#2563EB]' : ''}
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={conversationFilter === 'active' ? 'default' : 'outline'}
                        onClick={() => setConversationFilter('active')}
                        className={conversationFilter === 'active' ? 'bg-[#2563EB]' : ''}
                      >
                        Active
                      </Button>
                      <Button
                        size="sm"
                        variant={conversationFilter === 'resolved' ? 'default' : 'outline'}
                        onClick={() => setConversationFilter('resolved')}
                        className={conversationFilter === 'resolved' ? 'bg-[#2563EB]' : ''}
                      >
                        Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant={conversationFilter === 'escalated' ? 'default' : 'outline'}
                        onClick={() => setConversationFilter('escalated')}
                        className={conversationFilter === 'escalated' ? 'bg-[#2563EB]' : ''}
                      >
                        Escalated
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    {filteredConversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedConversation(conv)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-medium">
                              {conv.customerName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900">{conv.customerName}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(conv.status)}`}>
                                {conv.status}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500">{formatTime(conv.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Conversation Detail */}
            <div className="lg:col-span-2">
              {selectedConversation ? (
                <div className="space-y-4">
                  {/* Customer Info Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-medium text-lg">
                            {selectedConversation.customerName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{selectedConversation.customerName}</CardTitle>
                            <p className="text-sm text-gray-500">{selectedConversation.customerEmail}</p>
                          </div>
                        </div>
                        <span className={`text-sm px-3 py-1 rounded-full ${getStatusColor(selectedConversation.status)}`}>
                          {selectedConversation.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Messages</p>
                          <p className="font-medium text-gray-900">{selectedConversation.messageCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Started</p>
                          <p className="font-medium text-gray-900">{formatTime(selectedConversation.timestamp)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conversation Thread */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Conversation Thread</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
                        {selectedConversation.messages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[70%] rounded-lg p-3 ${
                              msg.sender === 'customer'
                                ? 'bg-gray-100 text-gray-900'
                                : 'bg-[#2563EB] text-white'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                {msg.sender === 'customer' ? (
                                  <User className="h-3 w-3" />
                                ) : (
                                  <MessageSquare className="h-3 w-3" />
                                )}
                                <span className="text-xs opacity-75">
                                  {msg.sender === 'customer' ? 'Customer' : 'AI Agent'}
                                </span>
                              </div>
                              <p className="text-sm">{msg.content}</p>
                              <p className="text-xs opacity-75 mt-1">{formatTime(msg.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={handleMarkResolved}
                          disabled={selectedConversation.status === 'resolved'}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Resolved
                        </Button>
                        <Button
                          className="flex-1 bg-orange-600 hover:bg-orange-700"
                          onClick={handleEscalate}
                          disabled={selectedConversation.status === 'escalated'}
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Escalate to Human
                        </Button>
                        <Button variant="outline" className="flex-1">
                          Add Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="h-full">
                  <CardContent className="flex items-center justify-center h-[500px]">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Knowledge Base Screen */}
        {activeScreen === 'knowledge' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Website Crawling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter website URL to crawl..."
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCrawlWebsite()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleCrawlWebsite}
                    disabled={isCrawling || !websiteUrl.trim()}
                    className="bg-[#2563EB]"
                  >
                    {isCrawling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Crawling...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Crawl Website
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter a website URL to automatically index its content for the AI knowledge base
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Indexed Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {indexedPages.length > 0 ? (
                    indexedPages.map((page, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{page.url}</p>
                          <p className="text-xs text-gray-500">Last updated: {page.lastUpdated.toLocaleString()}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No pages indexed yet</p>
                      <p className="text-sm">Crawl a website to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <KnowledgeBaseUpload ragId={RAG_ID} />
                <p className="text-sm text-gray-500 mt-3">
                  Upload PDF, DOCX, or text files to add to the knowledge base
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test Chat Widget Screen */}
        {activeScreen === 'chat' && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Chat Widget Preview</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Test the customer-facing chat interface</p>
              </CardHeader>
              <CardContent>
                {showCustomerForm ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                      <Input
                        placeholder="Enter your name..."
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Email</label>
                      <Input
                        type="email"
                        placeholder="Enter your email..."
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleStartChat}
                      disabled={!customerName.trim() || !customerEmail.trim()}
                      className="w-full bg-[#2563EB]"
                    >
                      Start Chat
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Chat Messages */}
                    <div className="bg-gray-50 rounded-lg p-4 h-[400px] overflow-y-auto space-y-3">
                      {currentMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.isTyping ? (
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            </div>
                          ) : (
                            <div className={`max-w-[80%] rounded-lg p-3 shadow-sm ${
                              msg.sender === 'customer'
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-white text-gray-900'
                            }`}>
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 ${
                                msg.sender === 'customer' ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {formatTime(msg.timestamp)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Message Input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={userMessage}
                        onChange={(e) => setUserMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={isLoading || !userMessage.trim()}
                        className="bg-[#2563EB]"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Reset Chat */}
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        Chatting as {customerName}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCustomerForm(true)
                          setCurrentMessages([])
                          setCustomerName('')
                          setCustomerEmail('')
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Reset Chat
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Floating Chat Widget (Customer-Facing) - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        {!chatExpanded ? (
          <Button
            onClick={() => setChatExpanded(true)}
            className="h-14 w-14 rounded-full bg-[#2563EB] shadow-lg hover:shadow-xl transition-shadow"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        ) : (
          <Card className="w-96 shadow-2xl">
            <CardHeader className="bg-[#2563EB] text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle className="text-base">OmniServe Support</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setChatExpanded(false)}
                  className="text-white hover:bg-blue-700 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-blue-100 mt-1">We typically reply instantly</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 overflow-y-auto p-4 bg-gray-50 space-y-3">
                <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
                  <p className="text-sm text-gray-900">Hello! How can we help you today?</p>
                </div>
              </div>
              <div className="p-4 bg-white border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button className="bg-[#2563EB]">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <User className="h-3 w-3 mr-2" />
                  Talk to a Human
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
