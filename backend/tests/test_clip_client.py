"""
Tests for ML CLIP client functions.
"""
import pytest
from unittest.mock import patch, MagicMock
from PIL import Image
import io
import numpy as np
import tempfile
import os


class TestClipClient:
    """Test suite for app.ml.clip_client"""

    @patch('app.ml.clip_client.model')
    def test_generate_embedding_success(self, mock_model):
        """Test successful image embedding generation"""
        # Mock the model's encode method
        mock_embedding = np.random.rand(512).tolist()
        mock_model.encode.return_value = np.array(mock_embedding)
        
        # Create a temporary image file
        img = Image.new('RGB', (100, 100), color='red')
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            img.save(tmp.name, 'JPEG')
            tmp_path = tmp.name
        
        try:
            from app.ml.clip_client import generate_embedding
            result = generate_embedding(tmp_path)
            
            assert result is not None
            assert isinstance(result, list)
            assert len(result) == 512
            mock_model.encode.assert_called_once()
        finally:
            os.unlink(tmp_path)

    @patch('app.ml.clip_client.model')
    def test_generate_embedding_file_not_found(self, mock_model):
        """Test embedding generation with non-existent file"""
        from app.ml.clip_client import generate_embedding
        result = generate_embedding("/nonexistent/path/image.jpg")
        
        assert result is None

    @patch('app.ml.clip_client.model')
    def test_generate_embedding_exception(self, mock_model):
        """Test embedding generation with exception"""
        mock_model.encode.side_effect = Exception("Model error")
        
        img = Image.new('RGB', (100, 100))
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            img.save(tmp.name, 'JPEG')
            tmp_path = tmp.name
        
        try:
            from app.ml.clip_client import generate_embedding
            result = generate_embedding(tmp_path)
            assert result is None
        finally:
            os.unlink(tmp_path)

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_success(self, mock_model):
        """Test successful text embedding generation"""
        mock_embedding = np.random.rand(512).tolist()
        mock_model.encode.return_value = np.array(mock_embedding)
        
        from app.ml.clip_client import generate_text_embedding
        result = generate_text_embedding("beach sunset")
        
        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 512
        mock_model.encode.assert_called_once_with("beach sunset")

    @patch('app.ml.clip_client.model')
    def test_generate_text_embedding_empty_string(self, mock_model):
        """Test text embedding with empty string"""
        mock_embedding = np.random.rand(512).tolist()
        mock_model.encode.return_value = np.array(mock_embedding)
        
        from app.ml.clip_client import generate_text_embedding
        result = generate_text_embedding("")
        
        assert result is not None
        assert isinstance(result, list)
