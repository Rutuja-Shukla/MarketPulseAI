"""Model registry — importing this module registers every mapper."""
from app.models.chat import ChatConversation, ChatMessage
from app.models.evidence import EvidenceRecord, SentimentRecord, TopicCluster
from app.models.findings import (
    FailureFinding,
    OpportunityFinding,
    RoadmapItem,
    SimulationScenario,
    StrategicRelationship,
)
from app.models.reporting import MonitoringConfiguration, Notification, Report
from app.models.research import (
    Competitor,
    CompetitorObservation,
    ResearchConfiguration,
    ResearchProject,
    ResearchSource,
    ResearchTask,
)
from app.models.user import Company, Product, User

__all__ = [
    "ChatConversation",
    "ChatMessage",
    "Company",
    "Competitor",
    "CompetitorObservation",
    "EvidenceRecord",
    "FailureFinding",
    "MonitoringConfiguration",
    "Notification",
    "OpportunityFinding",
    "Product",
    "Report",
    "ResearchConfiguration",
    "ResearchProject",
    "ResearchSource",
    "ResearchTask",
    "RoadmapItem",
    "SentimentRecord",
    "SimulationScenario",
    "StrategicRelationship",
    "TopicCluster",
    "User",
]
