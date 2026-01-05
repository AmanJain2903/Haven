"""
Tests for ML/AI client functions.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.ml.clip_client import generate_embedding, generate_text_embedding


class TestGenerateEmbedding:
    """Test suite for image embedding generation"""

    @patch('app.ml.clip_client.model')
    @patch('app.ml.clip_client.Image.open')
    def test_generate_embedding_success(self, mock_img_open, mock_model):
        """Test successful embedding generation"""
        # Mock PIL Image
        mock_image = MagicMock()
        mock_img_open.return_value = mock_image
        
        # Mock model output
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.5] * 512
        mock_model.encode.return_value = mock_embedding
        
        result = generate_embedding('/test/photo.jpg')
        
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 512
        mock_img_open.assert_called_once_with('/test/photo.jpg')
        mock_model.encode.assert_called_once_with(mock_image)

    @patch('app.ml.clip_client.Image.open')
    def test_generate_embedding_file_not_found(self, mock_img_open):
        """Test handling when image file doesn't exist"""
        mock_img_open.side_effect = FileNotFoundError("File not found")
        
        result = generate_embedding('/invalid/path.jpg')
        
        assert result is None

    @patch('app.ml.clip_client.model')
    @patch('app.ml.clip_client.Image.open')
    def test_generate_embedding_model_error(self, mock_img_open, mock_model):
        """Test handling when model fails to generate embedding"""
        mock_img_open.return_value = MagicMock()
        mock_model.encode.side_effect = Exception("Model error")
        
        result = generate_embedding('/test/photo.jpg')
        
        assert result is None

    @patch('app.ml.clip_client.model')
    @patch('app.ml.clip_client.Image.open')
    def test_generate_embedding_heic_support(self, mock_img_open, mock_model):
        """Test that HEIC files are processed"""
        mock_image = MagicMock()
        mock_img_open.return_value = mock_image
        
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.5] * 512
        mock_model.encode.return_value = mock_embedding
        
        result = generate_embedding('/test/iphone_photo.heic')
        
        assert result is not None
        assert len(result) == 512


class TestGenerateTextEmbedding:
    """Test suite for text query embedding generation"""

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_success(self, mock_model):
        """Test successful text embedding generation"""
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.3] * 512
        mock_model.encode.return_value = mock_embedding
        
        result = generate_text_embedding("dog in park")
        
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 512
        mock_model.encode.assert_called_once_with("dog in park")

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_empty_string(self, mock_model):
        """Test embedding generation with empty string"""
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.0] * 512
        mock_model.encode.return_value = mock_embedding
        
        result = generate_text_embedding("")
        
        assert result is not None
        assert isinstance(result, list)

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_special_characters(self, mock_model):
        """Test embedding generation with special characters"""
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.2] * 512
        mock_model.encode.return_value = mock_embedding
        
        result = generate_text_embedding("dog & cat @ park!")
        
        assert result is not None
        assert len(result) == 512

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_long_query(self, mock_model):
        """Test embedding generation with long text query"""
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.4] * 512
        mock_model.encode.return_value = mock_embedding
        
        long_query = "a beautiful sunset over the ocean with palm trees and people walking on the beach"
        result = generate_text_embedding(long_query)
        
        assert result is not None
        assert len(result) == 512
